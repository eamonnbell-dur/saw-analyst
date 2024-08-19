<template>
        <input v-model="newWord" @keyup.enter="addWord" placeholder="Enter a word" />
        <button @click="addWord">Add word</button>
        <div class="stack">
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
* {
    max-width: 400px;
    margin: 0 auto;
    text-align: center;
}

.relation-stack>input {
    padding: 8px;
    margin-bottom: 10px;
    width: calc(100% - 16px);
    box-sizing: border-box;
}

.relation-stack>button {
    padding: 8px 16px;
    margin-bottom: 20px;
    cursor: pointer;
}

.relation-stack>.stack {
    border: 1px solid #ccc;
    padding: 10px;
    border-radius: 5px;
}
</style>