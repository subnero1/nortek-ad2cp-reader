<script setup>
import { counts } from './store.js'
const labels = Object.freeze({
  0x15: 'Burst',
  0x16: 'Average',
  0x17: 'Bottom Track',
  0x18: 'Interleaved Burst',
  0x1e: 'Altimeter',
  0x1f: 'Raw Altimeter',
  0x1a: 'Burst Altimeter',
  0x1b: 'DVL Bottom Track',
  0x1c: 'Echo Sounder',
  0x23: 'Raw Echo Sounder',
  0x24: 'Raw Echo Sounder TX',
  0x26: 'Average DF7',
  0x30: 'Wave',
  0xc8: 'Vector 2',
  0xa0: 'String',
})
</script>

<template>
  <table>
    <tbody>
      <tr>
        <th>Type</th>
        <td v-for="(count, type) in counts">
          {{ labels[type] }}
        </td>
      </tr>
      <tr>
        <th>Count</th>
        <td v-for="(count, type) in counts">
          {{ count }}
        </td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
@reference "./style.css";

table {
  @apply table w-auto;
}
td {
  @apply text-center;
}
</style>
