<template>
    <div class="saw-analyst">
        <SawStage ref="originStage"
            example-url="https://cdm21066.contentdm.oclc.org/iiif/2/BDC:315/full/full/0/default.jpg"
            @maskSelected="handleMaskSelected('origin', $event)"></SawStage>
        <RelationStack ref="relationStack">
            <template v-slot:default="{ emitAddRelation }">
                <button @click="emitAddRelation">Add Relation</button>
            </template>
        </RelationStack>
        <SawStage ref="destinationStage"
            example-url="https://cdm21066.contentdm.oclc.org/iiif/2/BDC:315/full/full/0/default.jpg"
            @maskSelected="handleMaskSelected('destination', $event)"></SawStage>
    </div>
</template>

<script>
import SawStage from '@/components/SawStage.vue'
import RelationStack from '@/components/RelationStack.vue'

export default {
    name: 'SawAnalyst',
    data() {
        return {
            originMask: null,
            destinationMask: null,
            relations: []
        };
    },
    methods: {
        handleMaskSelected(type, mask) {
            console.log({ type, mask });
            if (type === 'origin') {
                this.originMask = mask;
            } else if (type === 'destination') {
                this.destinationMask = mask;
            }
        },
        addRelation() {
            const activeRelation = this.$refs.relationStack.getActiveRelation();
            if (this.originMask && this.destinationMask && activeRelation) {
                const relation = {
                    origin: this.originMask,
                    destination: this.destinationMask,
                    relationName: activeRelation
                };
                console.log(relation);
                this.relations.push(relation);
                this.originMask = null;
                this.destinationMask = null;
            }
        }
    },
    components: {
        SawStage,
        RelationStack
    }
}
</script>

<style scoped>
</style>