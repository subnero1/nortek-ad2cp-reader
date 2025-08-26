<script setup>
import { ref, computed, watch, useTemplateRef, onMounted } from 'vue'
import { use } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { LineChart, GaugeChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import VChart from 'vue-echarts'

import { records } from './store.js'

use([SVGRenderer, LineChart, GaugeChart, GridComponent, TooltipComponent, LegendComponent])

function quantile(array, q) {
  array = array.sort()
  const x = array.length * q
  const a = Math.floor(x)
  const b = Math.ceil(x)
  return ((b - x) * array[a] + (x - a) * array[b]) / (b - a)
}

const direction = ref('total')
const allData = computed(() => {
  const allData = {}
  for (const record of records.value) {
    if (record.dataSeriesId !== 0x16) continue
    const nCells = record.numberOfCells
    const nBeams = record.numberOfBeams
    const vel = record.velocityData
    const params = {
      coordinateSystem: record.coordinateSystemLabel,
      nCells: nCells,
      cellSize: record.cellSize,
      blankingDistance: record.blankingDistance,
    }
    const key = Object.values(params).join('|')
    const data = (allData[key] = allData[key] ?? {
      ...params,
      dateTime: [],
      cells: Array.from({ length: nCells }, () => ({ velocity: [] })),
    })
    data.dateTime.push(record.dateTime.valueOf())
    if (record.coordinateSystemLabel !== 'BEAM') {
      for (let i = 0; i < nCells; i++) {
        const vx = vel[0 * nCells + i]
        const vy = vel[1 * nCells + i]
        const vz =
          nBeams == 3 ? vel[2 * nCells + i] : 0.5 * (vel[2 * nCells + i] + vel[3 * nCells + i])
        if (direction.value === 'total') {
          data.cells[i].velocity.push(Math.hypot(vx, vy, vz))
        }
        if (direction.value === 'vertical') {
          data.cells[i].velocity.push(vz)
        }
        if (typeof direction.value === 'number') {
          data.cells[i].velocity.push(
            vx * Math.cos(direction.value) + vy * Math.sin(direction.value),
          )
        }
      }
    }
  }
  for (const data of Object.values(allData)) {
    data.referenceVelocity =
      2 *
      quantile(
        data.cells.flatMap((cell) => cell.velocity.map((v) => Math.abs(v))),
        0.9,
      )
  }
  return allData
})

const chosenKey = ref()
const data = computed(() => allData.value[chosenKey.value])
watch(
  () => Object.keys(allData.value),
  (keys) => {
    if (keys.includes(chosenKey.value)) return
    chosenKey.value = keys[0]
  },
  { immediate: true },
)

const gaugeLineWidth = 10

const directionPicker = useTemplateRef('directionPicker')
function pickDirection(event) {
  direction.value = Math.atan2(
    directionPicker.value.clientHeight / 2 - event.offsetY,
    event.offsetX - directionPicker.value.clientWidth / 2,
  )
}
</script>

<template>
  <div class="flex items-center w-[800px]">
    <div v-if="Object.keys(allData).length > 1">
      <div class="tabs tabs-box">
        <input
          v-for="(key, idx) in Object.keys(allData)"
          :key="key"
          type="radio"
          class="tab"
          :aria-label="`Set ${idx + 1}`"
          v-model="chosenKey"
          :value="key"
        />
      </div>
    </div>
    <VChart
      style="width: 800px; height: 500px"
      :option="{
        xAxis: { type: 'time' },
        yAxis: { axisLabel: { formatter: `{value}m` } },
        grid: { top: 10, bottom: 0, containLabel: true, left: 0, right: 30 },
        symbol: 'none',
        series: data.cells.map((cell, cellIdx) => ({
          type: 'line',
          symbol: 'none',
          color: 'grey',
          lineStyle: { width: 0 },
          areaStyle: { origin: data.blankingDistance + data.cellSize * (cellIdx + 1) },
          data: cell.velocity
            .filter((v) => Math.abs(v) <= data.referenceVelocity)
            .map((v, timeIdx) => [
              data.dateTime[timeIdx],
              data.blankingDistance +
                data.cellSize *
                  (cellIdx +
                    1 +
                    (0.9 * v) / ((direction === 'total' ? 1 : 2) * data.referenceVelocity)),
            ]),
        })),
      }"
    />
    <div class="text-xs flex flex-col gap-2">
      <div class="flex flex-col gap-1">
        <div>Coordinates: {{ data.coordinateSystem }}</div>
        <div class="mb-2">Max: {{ data.referenceVelocity.toFixed(1) }} m/s</div>
      </div>
      <div class="flex flex-col gap-2">
        <label
          v-for="dir in ['total', 'vertical']"
          :key="dir"
          class="flex gap-2 cursor-pointer items-center"
        >
          <input
            type="radio"
            name="direction"
            class="radio radio-xs"
            :value="dir"
            v-model="direction"
          />
          {{ dir.charAt(0).toUpperCase() + dir.slice(1) }}
        </label>
        <label class="flex gap-2 cursor-pointer items-center">
          <input
            type="radio"
            name="direction"
            class="radio radio-xs"
            @click="direction = 0"
            :checked="typeof direction === 'number'"
          />
          Horizontal
        </label>
        <div @click="pickDirection" ref="directionPicker" class="ml-4">
          <VChart
            style="width: 100px; height: 100px"
            :option="{
              series: {
                type: 'gauge',
                startAngle: 180,
                endAngle: -180,
                min: 180,
                max: -180,
                radius: '90%',
                splitNumber: 4,
                splitLine: { length: gaugeLineWidth, distance: -gaugeLineWidth },
                axisTick: { splitNumber: 2, length: gaugeLineWidth, distance: -gaugeLineWidth },
                axisLabel: {
                  distance: gaugeLineWidth + 10,
                  formatter: (angle) => {
                    if (data.coordinateSystem === 'ENU') {
                      return { 0: 'E', 90: 'N', 180: 'W', '-90': 'S', '-180': '' }[angle]
                    }
                    if (data.coordinateSystem === 'XYZ') {
                      return { 0: 'Y', 90: 'X', 180: '', '-90': '', '-180': '' }[angle]
                    }
                    return ''
                  },
                },
                axisLine: { show: false },
                detail: { show: false },
                data: typeof direction === 'number' ? [{ value: (180 / Math.PI) * direction }] : [],
              },
            }"
          />
        </div>
      </div>
    </div>
  </div>
</template>
