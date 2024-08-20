<template>
    <div class="saw-stage">
        <div class="container" @mousedown="handleMouseDown" @mousemove="handleMouseMove" ref="imageContainer"
            @contextmenu.prevent>
            <label class="upload-button" :for="`input-${id}`" ref="uploadButton">
                Click to upload image
                <label class="example" @click="useExample">(or try example)</label>
            </label>
            <canvas class="mask-output" ref="maskCanvas"></canvas>
        </div>
        <label class="status" ref="statusLabel"></label>
        <div class="controls">
            <button @click="resetImage" ref="resetButton">Reset image</button>
            <button @click="clearPointsAndMask" ref="clearButton">Clear points</button>
            <button @click="cutMask" :disabled="isCutMaskDisabled">Cut mask</button>
            <button @click="confirmMask" :disabled="isCutMaskDisabled">Confirm mask</button>
        </div>
        <p class="information">
            Left click = positive points, right click = negative points.
        </p>
        <input style="display: none;" :id="`input-${id}`" type="file" accept="image/*" @change="handleUpload" />
    </div>
</template>

<script>
export default {
    name: 'SawStage',
    props: {
        exampleUrl: {
            type: String,
            required: false
        },
        id: {
            type: [String, Number],
            required: true
        }
    },
    data() {
        return {
            isCutMaskDisabled: true,
            isEncoded: false,
            isMultiMaskMode: false,
            modelReady: false,
            isDecoding: false,
            imageDataURI: '',
            worker: null,
        };
    },

    mounted() {

        const BASE_URL = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/';

        this.star = new Image();
        this.star.src = BASE_URL + 'star-icon.png';
        this.star.className = 'icon';

        this.cross = new Image();
        this.cross.src = BASE_URL + 'cross-icon.png';
        this.cross.className = 'icon';

        this.lastPoints = [];

        this.worker = new Worker('worker.js', { type: 'module' });
        this.worker.onmessage = this.handleWorkerMessage;

    },

    beforeDestroy() {
        if (this.worker) {
            this.worker.terminate();
        }
    },

    methods: {
        resetImage() {
            this.isEncoded = false;
            this.imageDataURI = null;
            this.worker.postMessage({ type: 'reset' });
            this.clearPointsAndMask();
            this.isCutMaskDisabled = true;
            this.$refs.imageContainer.style.backgroundImage = 'none';
            this.$refs.uploadButton.style.display = 'flex';
            this.$refs.statusLabel.textContent = 'Ready';
        },
        confirmMask() {
            const [w, h] = [this.$refs.maskCanvas.width, this.$refs.maskCanvas.height];
            const maskContext = this.$refs.maskCanvas.getContext('2d');
            const maskPixelData = maskContext.getImageData(0, 0, w, h);
            this.$emit('maskSelected', maskPixelData);
        },
        cutMask() {
            const [w, h] = [this.$refs.maskCanvas.width, this.$refs.maskCanvas.height];
            const maskContext = this.$refs.maskCanvas.getContext('2d');
            const maskPixelData = maskContext.getImageData(0, 0, w, h);

            const image = new Image();
            image.crossOrigin = 'anonymous';
            image.onload = async () => {
                const imageCanvas = new OffscreenCanvas(w, h);
                const imageContext = imageCanvas.getContext('2d');
                imageContext.drawImage(image, 0, 0, w, h);
                const imagePixelData = imageContext.getImageData(0, 0, w, h);

                const cutCanvas = new OffscreenCanvas(w, h);
                const cutContext = cutCanvas.getContext('2d');
                const cutPixelData = cutContext.getImageData(0, 0, w, h);

                for (let i = 3; i < maskPixelData.data.length; i += 4) {
                    if (maskPixelData.data[i] > 0) {
                        for (let j = 0; j < 4; ++j) {
                            const offset = i - j;
                            cutPixelData.data[offset] = imagePixelData.data[offset];
                        }
                    }
                }
                cutContext.putImageData(cutPixelData, 0, 0);

                const link = document.createElement('a');
                link.download = 'image.png';
                link.href = URL.createObjectURL(await cutCanvas.convertToBlob());
                link.click();
                link.remove();
            };
            image.src = this.imageDataURI;
        },
        handleUpload(event) {
            const file = event.target.files[0];
            if (!file) {
                return;
            }

            const reader = new FileReader();
            reader.onload = e => this.segment(e.target.result);
            reader.readAsDataURL(file);
        },
        segment(data) {
            if (!this.worker) {
                console.error('Worker is not initialized');
                return;
            }
            this.isEncoded = false;
            if (!this.modelReady) {
                this.$refs.statusLabel.textContent = 'Loading model...';
            }
            this.imageDataURI = data;

            const img = new Image();

            img.onload = () => {
                this.adjustCanvasSize(img);
                this.$refs.imageContainer.style.backgroundImage = `url(${data})`;
                this.$refs.uploadButton.style.display = 'none';
                this.isCutMaskDisabled = true;
                this.worker.postMessage({ type: 'segment', data });
            }

            img.src = data;

        },

        adjustCanvasSize(img) {
            const container = this.$refs.imageContainer;
            const canvas = this.$refs.maskCanvas;
            const aspectRatio = img.width / img.height;

            // Adjust container size
            container.style.width = '100%';
            container.style.height = `${container.clientWidth / aspectRatio}px`;

            // Adjust canvas size
            canvas.width = container.clientWidth;
            canvas.height = container.clientHeight;
        },
        useExample(event) {
            event.preventDefault();
            this.segment(this.exampleUrl);
        },

        addIcon({ point, label }) {
            const icon = (label === 1 ? this.star : this.cross).cloneNode();
            icon.style.left = `${point[0] * 100}%`;
            icon.style.top = `${point[1] * 100}%`;
            this.$refs.imageContainer.appendChild(icon);
        },
        getPoint(e) {
            const bb = this.$refs.imageContainer.getBoundingClientRect();
            const mouseX = this.clamp((e.clientX - bb.left) / bb.width);
            const mouseY = this.clamp((e.clientY - bb.top) / bb.height);

            return {
                point: [mouseX, mouseY],
                label: e.button === 2 ? 0 : 1,
            };
        },
        clamp(x, min = 0, max = 1) {
            return Math.max(Math.min(x, max), min);
        },

        decode() {
            this.isDecoding = true;
            const message = { type: 'decode', data: this.lastPoints };
            this.worker.postMessage(message);
        },

        clearPointsAndMask() {
            this.isMultiMaskMode = false;
            this.lastPoints = null;
            this.$refs.imageContainer.querySelectorAll('.icon').forEach(e => e.remove());
            this.isCutMaskDisabled = true;
            this.$refs.maskCanvas.getContext('2d').clearRect(0, 0, this.$refs.maskCanvas.width, this.$refs.maskCanvas.height);
        },

        handleMouseDown(e) {
            if (e.button !== 0 && e.button !== 2) {
                return;
            }
            if (!this.isEncoded) {
                return;
            }
            if (!this.isMultiMaskMode) {
                this.lastPoints = [];
                this.isMultiMaskMode = true;
                this.isCutMaskDisabled = false;
            }

            const point = this.getPoint(e);
            this.lastPoints.push(point);
            this.addIcon(point);
            this.decode();
        },

        handleMouseMove(e) {
            if (!this.isEncoded || this.isMultiMaskMode) {
                return;
            }
            this.lastPoints = [this.getPoint(e)];
            if (!this.isDecoding) {
                this.decode();
            }
        },

        handleWorkerMessage(e) {
            const { type, data } = e.data;
            if (type === 'ready') {
                this.modelReady = true;
                this.$refs.statusLabel.textContent = 'Ready';
            } else if (type === 'decode_result') {
                this.isDecoding = false;
                if (!this.isEncoded) {
                    return;
                }
                if (!this.isMultiMaskMode && this.lastPoints) {
                    this.decode();
                    this.lastPoints = null;
                }
                const { mask, scores } = data;
                if (this.$refs.maskCanvas.width !== mask.width || this.$refs.maskCanvas.height !== mask.height) {
                    this.$refs.maskCanvas.width = mask.width;
                    this.$refs.maskCanvas.height = mask.height;
                }
                const context = this.$refs.maskCanvas.getContext('2d');
                const imageData = context.createImageData(this.$refs.maskCanvas.width, this.$refs.maskCanvas.height);
                const numMasks = scores.length;
                let bestIndex = 0;
                for (let i = 1; i < numMasks; ++i) {
                    if (scores[i] > scores[bestIndex]) {
                        bestIndex = i;
                    }
                }
                this.$refs.statusLabel.textContent = `Segment score: ${scores[bestIndex].toFixed(2)}`;
                const pixelData = imageData.data;
                for (let i = 0; i < pixelData.length; ++i) {
                    if (mask.data[numMasks * i + bestIndex] === 1) {
                        const offset = 4 * i;
                        pixelData[offset] = 0;
                        pixelData[offset + 1] = 114;
                        pixelData[offset + 2] = 189;
                        pixelData[offset + 3] = 255;
                    }
                }
                context.putImageData(imageData, 0, 0);
            } else if (type === 'segment_result') {
                if (data === 'start') {
                    this.$refs.statusLabel.textContent = 'Extracting image embedding...';
                } else {
                    this.$refs.statusLabel.textContent = 'Embedding extracted!';
                    this.isEncoded = true;
                }
            }
        },
    }
}

</script>

<style scoped>
canvas {
    position: absolute;
    width: 100%;
    height: 100%;
    opacity: 0.6;
}

.saw-stage {
    text-align: center;
}

.saw-stage>button {
    padding: 8px 16px;
    margin-bottom: 20px;
    cursor: pointer;
}

.example {
    font-size: 14px;
    text-decoration: underline;
    cursor: pointer;
}

.example:hover {
    color: #2563EB;
}

.status {
    min-height: 16px;
    margin: 8px 0;
}


.controls>button {
    padding: 6px 12px;
    background-color: #3498db;
    color: white;
    border: 1px solid #2980b9;
    border-radius: 5px;
    cursor: pointer;
    font-size: 16px;
}

.controls>button:disabled {
    background-color: #d1d5db;
    color: #6b7280;
    border: 1px solid #9ca3af;
    cursor: not-allowed;
}

.information {
    margin-top: 0.25rem;
    font-size: 15px;
}


.mask-output {
    position: absolute;
    width: 100%;
    height: 100%;
    pointer-events: none;
}

.upload-button {
    gap: 0.4rem;
    font-size: 18px;
    cursor: pointer;
}

.upload {
    display: none;
}

.container {
    position: relative;
    width: 640px;
    height: 420px;
    max-width: 100%;
    max-height: 100%;
    border: 2px dashed #D1D5DB;
    border-radius: 0.75rem;
    overflow: hidden;
    cursor: pointer;
    margin-top: 1rem;
    background-size: 100% 100%;
    background-position: center;
    background-repeat: no-repeat;
}
</style>