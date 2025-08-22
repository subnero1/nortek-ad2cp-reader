<script setup>
import CopyToClipboard from './CopyToClipboard.vue'
const props = defineProps(['data'])
</script>

<template>
  <div class="collapse collapse-arrow border border-base-300">
    <input type="checkbox" />
    <div class="collapse-title font-semibold">Raw Data</div>
    <div class="collapse-content text-sm overflow-x-auto">
      <div class="relative">
        <CopyToClipboard :data="props.data" class="absolute top-2 right-2" />
        <pre class="overflow-auto my-0! max-h-[400px]">{{ props.data }}</pre>
      </div>
    </div>
  </div>
</template>
