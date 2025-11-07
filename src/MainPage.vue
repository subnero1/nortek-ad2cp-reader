<script setup>
import { ref } from 'vue'
import { parseAd2cp } from './nortek.js'
import { records, counts } from './store.js'
import CountsTable from './CountsTable.vue'
import DeviceCharts from './DeviceCharts.vue'
import WaveCharts from './WaveCharts.vue'
import CurrentCharts from './CurrentCharts.vue'

const parseError = ref('')
async function addFile(file) {
  if (file === undefined) return
  try {
    const buffer = new Uint8Array(await file.arrayBuffer())
    const plainData = parseAd2cp(buffer)
    console.log(file.name, plainData)
    records.value = plainData
  } catch (error) {
    records.value = []
    parseError.value = 'Could not parse file.'
    throw error
  }
  parseError.value = ''
}
</script>

<template>
  <div class="text-sm">
    <b>Note:</b>
    This tool has been tested on only a limited set of examples. Results may vary depending on the
    type of data in your file, so we recommend trying it first on a reference dataset similar to
    your application before relying on it for detailed analysis. Also, please note that this tool
    currently cannot handle large datasets.
  </div>

  <input
    type="file"
    accept=".ad2cp"
    @change="addFile($event.target.files[0])"
    class="file-input w-full mt-8"
    :class="{ 'file-input-error': parseError !== '' }"
  />
  <div class="text-sm text-error mt-2">
    {{ parseError }}
  </div>

  <template v-if="records.length !== 0">
    <h2>Data Set</h2>
    <CountsTable />

    <h2>Device</h2>
    <DeviceCharts />

    <template v-if="counts[0x16 /* Average */] > 0 || counts[0x26 /* df7CurrentProfileData */] > 0">
      <h2>Currents</h2>
      <CurrentCharts />
    </template>

    <template v-if="counts[0x30 /* Wave */] > 0">
      <h2>Wave</h2>
      <WaveCharts />
    </template>
  </template>
</template>
