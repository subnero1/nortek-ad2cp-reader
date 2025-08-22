<script setup>
import { ref } from 'vue'

const props = defineProps(['data'])

const hasCopied = ref(false)
let timeout
async function copyToClipboard() {
  console.log('copying')
  await navigator.clipboard.writeText(props.data)
  hasCopied.value = true
  if (timeout) clearTimeout(timeout)
  timeout = setTimeout(() => {
    hasCopied.value = false
  }, 2000)
}
</script>
<template>
  <button class="btn btn-xs" @click.prevent="copyToClipboard">
    {{ !hasCopied ? 'Copy' : 'Copied!' }}
  </button>
</template>
