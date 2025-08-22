<script setup>
import { ref, onMounted } from 'vue'
const license = ref('')
onMounted(async () => {
  license.value = await fetch('../LICENSE.md').then((res) => res.text())
})
</script>

<template>
  <pre class="mt-0 text-neutral bg-base-100">{{ license }}</pre>
  <h2>Third-Party Licenses</h2>
</template>
