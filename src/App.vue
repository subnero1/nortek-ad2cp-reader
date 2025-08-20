<script setup>
import { parseAd2cp } from './nortek.js'
import { records } from './store.js'
import CountsTable from './CountsTable.vue'
import DeviceCharts from './DeviceCharts.vue'

async function addFile(file) {
  if (file === undefined) return
  const buffer = new Uint8Array(await file.arrayBuffer())
  const plainData = parseAd2cp(buffer)
  console.log(file.name, plainData)
  records.value = plainData
}
</script>

<template>
  <h1>Nortek AD2CP Reader</h1>
  <input
    type="file"
    accept=".ad2cp"
    @change="addFile($event.target.files[0])"
    class="file-input w-full"
  />

  <template v-if="records.length !== 0">
    <h2>Data Set</h2>
    <CountsTable />

    <h2>Device</h2>
    <DeviceCharts />

    <h2>Data</h2>
    <p>Todo...</p>
  </template>
</template>
