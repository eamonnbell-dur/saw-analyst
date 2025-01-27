// author: Xenova
// source: https://huggingface.co/spaces/Xenova/segment-anything-web/blob/main/worker.js

import { env, SamModel, AutoProcessor, RawImage, Tensor } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.0-alpha.5';

// Since we will download the model from the Hugging Face Hub, we can skip the local model check
env.allowLocalModels = false;


async function getImageDigest(imageData) {
    // Create a new digest using the SHA-256 algorithm
    let digest = await crypto.subtle.digest('SHA-256', imageData);

    // Convert the digest to a hexadecimal string
    let hexDigest = Array.from(new Uint8Array(digest))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    return hexDigest;
}

// We adopt the singleton pattern to enable lazy-loading of the model and processor.
export class SegmentAnythingSingleton {
    static model_id = 'Xenova/slimsam-77-uniform';
    static model;
    static processor;
    static quantized = true;

    static getInstance() {
        if (!this.model) {
            this.model = SamModel.from_pretrained(this.model_id, {
                quantized: this.quantized,
                dtype: "fp16",
                device: "webgpu",
            });
        }
        if (!this.processor) {
            this.processor = AutoProcessor.from_pretrained(this.model_id);
        }

        return Promise.all([this.model, this.processor]);
    }
}


// State variables
let image_embeddings = null;
let image_inputs = null;
let ready = false;

// Naive cache
let cache = {};

self.onmessage = async (e) => {
    const [model, processor] = await SegmentAnythingSingleton.getInstance();
    if (!ready) {
        // Indicate that we are ready to accept requests
        ready = true;
        self.postMessage({
            type: 'ready',
        });

    }

    const { type, data } = e.data;
    if (type === 'reset') {
        image_inputs = null;
        image_embeddings = null;

    } else if (type === 'segment') {
        // Indicate that we are starting to segment the image
        self.postMessage({
            type: 'segment_result',
            data: 'start',
        });

        // Read the image and recompute image embeddings
        const image = await RawImage.read(e.data.data);

        // Compute a SHA-256 digest
        const image_digest = await getImageDigest(image.data);
        
        // Naive caching of image_embeddings
        // TODO: Use Web Caching API as is used in Transformers.js
        if (image_digest in cache){
            image_inputs = cache[image_digest].image_inputs;
            image_embeddings = cache[image_digest].image_embeddings;
        } else {
            image_inputs = await processor(image);
            image_embeddings = await model.get_image_embeddings(image_inputs);

            cache[image_digest] = {
                image_inputs,
                image_embeddings
            }
        }

        // Indicate that we have computed the image embeddings, and we are ready to accept decoding requests
        self.postMessage({
            type: 'segment_result',
            data: 'done',
        });

    } else if (type === 'decode') {
        // Prepare inputs for decoding
        const reshaped = image_inputs.reshaped_input_sizes[0];
        const points = data.map(x => [x.point[0] * reshaped[1], x.point[1] * reshaped[0]])
        const labels = data.map(x => BigInt(x.label));

        const input_points = new Tensor(
            'float32',
            points.flat(Infinity),
            [1, 1, points.length, 2],
        )
        const input_labels = new Tensor(
            'int64',
            labels.flat(Infinity),
            [1, 1, labels.length],
        )

        // Generate the mask
        const outputs = await model({
            ...image_embeddings,
            input_points,
            input_labels,
        })

        // Post-process the mask
        const masks = await processor.post_process_masks(
            outputs.pred_masks,
            image_inputs.original_sizes,
            image_inputs.reshaped_input_sizes,
        );

        // Send the result back to the main thread
        self.postMessage({
            type: 'decode_result',
            data: {
                mask: RawImage.fromTensor(masks[0][0]),
                scores: outputs.iou_scores.data,
            },
        });

    } else {
        throw new Error(`Unknown message type: ${type}`);
    }
}
