<template>
        <div class="stack">
            <input v-model="newWord" @keyup.enter="addWord" placeholder="Enter a word" />
            <button @click="addWord">Add word</button>
            <div v-for="(word, index) in words" :key="index" :class="['word', { active: index === activeIndex }]"
                @click="setActive(index)">
                {{ word }}
                <button class="delete-button" @click.stop="deleteWord(index)">⌫</button>
            </div>
            <div>
                <slot :emitAddRelation="emitAddRelation"></slot>
            </div>
        </div>
</template>

<script>
export default {
    name: 'RelationStack',
    data() {
        return {
            newWord: '',
            words: [],
            activeIndex: null,
        };
    },
    methods: {
        addWord() {
            if (this.newWord.trim() !== '') {
                this.words.push(this.newWord.trim());
                this.newWord = '';
            }
        },
        deleteWord(index) {
            this.words.splice(index, 1);
            if (this.activeIndex === index) {
                this.activeIndex = null;
            } else if (this.activeIndex > index) {
                this.activeIndex--;
            }
        },
        setActive(index) {
            this.activeIndex = index;
        },
        getActiveRelation() {
            return this.words[this.activeIndex];
        },
        emitAddRelation() {
            return this.$emit('add-relation');
        }
    }
}
</script>

<style scoped>
:host {
    max-width: 400px;
    margin: 0 auto;
    text-align: center;
}

input {
    padding: 8px;
    margin-bottom: 10px;
    width: calc(100% - 16px);
    box-sizing: border-box;
}

button {
    padding: 8px 16px;
    margin-bottom: 20px;
    cursor: pointer;
}

.stack {    
    border: 1px solid #ccc;
    padding: 10px;
    border-radius: 5px;
}

.word {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 5px;
    border-bottom: 1px solid #eee;
    cursor: pointer;
}

.word.active {
    background-color: #caddb8;
}

.word:last-child {
    border-bottom: none;
}

.delete-button {
    background-color: #e74c3c;
    color: white;
    border: none;
    padding: 5px 10px;
    cursor: pointer;
    border-radius: 3px;
}
</style>