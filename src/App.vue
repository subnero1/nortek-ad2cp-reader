<script setup>
import * as ad2cp from './ad2cp';

async function addFile(file) {
  if (file === undefined) { return; }
  const buffer = new Uint8Array(await file.arrayBuffer());
  console.log(buffer);
  console.log(ad2cp.parse(buffer));
}
</script>

<template>
  <h1 class="text-4xl font-bold mb-4">
    Nortek AD2CP Reader
  </h1>
  <input
    type="file"
    class="file-input w-full"
    accept=".ad2cp"
    @change="addFile($event.target.files[0])"
  >
</template>

<style scoped></style>
