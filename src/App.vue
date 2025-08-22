<script setup>
import { parseAd2cp } from './nortek.js'
import { records, counts } from './store.js'
import CountsTable from './CountsTable.vue'
import DeviceCharts from './DeviceCharts.vue'
import WaveCharts from './WaveCharts.vue'
import CurrentCharts from './CurrentCharts.vue'

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

  <div class="text-sm">
    <b>Note: </b>
    Nortek AD2CP files can encode a wide variety of data, and this tool has been test on only a very
    small subset of them. It is highly recommended that you first test it on a reference dataset
    typical of your application before using it for anything serious.
  </div>

  <input
    type="file"
    accept=".ad2cp"
    @change="addFile($event.target.files[0])"
    class="file-input w-full mt-8"
  />

  <template v-if="records.length !== 0">
    <h2>Data Set</h2>
    <CountsTable />

    <h2>Device</h2>
    <DeviceCharts />

    <template v-if="counts[0x16 /* Average */] > 0">
      <h2>Currents</h2>
      <CurrentCharts />
    </template>

    <template v-if="counts[0x30 /* Wave */] > 0">
      <h2>Wave</h2>
      <WaveCharts />
    </template>
  </template>
</template>
