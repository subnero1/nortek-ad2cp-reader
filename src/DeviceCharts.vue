<script setup>
import { computed } from 'vue'

import { use } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { LineChart, GaugeChart } from 'echarts/charts'
import { GridComponent } from 'echarts/components'
import VChart from 'vue-echarts'

import RawData from './RawData.vue'
import { records } from './store.js'

use([SVGRenderer, LineChart, GaugeChart, GridComponent])

const timeSeriesOptions = Object.freeze({
  grid: { top: '5%', bottom: 0, containLabel: true },
  xAxis: { type: 'time', splitNumber: 4 },
  color: 'rgb(64,64,64)',
})

const data = computed(() => {
  const tiltBins = Array.from({ length: 91 }, () => 0)
  const dirBins = Array.from({ length: 144 }, () => 0)
  const headingBins = Array.from({ length: 144 }, () => 0)

  for (const record of records.value) {
    const heading = record.heading
    const pitch = record.pitch
    const roll = record.roll
    if (heading !== undefined && pitch !== undefined && roll !== undefined) {
      const sinHeading = Math.sin((Math.PI / 180) * heading)
      const cosHeading = Math.cos((Math.PI / 180) * heading)
      const sinPitch = Math.sin((Math.PI / 180) * pitch)
      const cosPitch = Math.cos((Math.PI / 180) * pitch)
      const sinRoll = Math.sin((Math.PI / 180) * roll)
      const cosRoll = Math.cos((Math.PI / 180) * roll)

      const tilt = (180 / Math.PI) * Math.abs(Math.acos(cosPitch * cosRoll))
      tiltBins[Math.round((tiltBins.length / 90) * tilt)] += 1

      const dir =
        (180 / Math.PI) *
        Math.atan2(
          sinHeading * sinPitch * cosRoll - cosHeading * sinRoll,
          cosHeading * sinPitch * cosRoll + sinHeading * sinRoll,
        )
      dirBins[Math.ceil((dirBins.length / 360) * (dir + 180))] += 1

      headingBins[Math.ceil((headingBins.length / 360) * heading)] += 1
    }
  }
  const tiltBinsMax = Math.max(...tiltBins)
  const dirBinsMax = Math.max(...dirBins)
  const headingBinsMax = Math.max(...headingBins)
  return {
    tiltBins: tiltBins.map((count) => count / tiltBinsMax),
    dirBins: dirBins.map((count) => count / dirBinsMax),
    headingBins: headingBins.map((count) => count / headingBinsMax),
  }
})

const rawData = computed(() => {
  const lines = [
    ['DateTime', 'BatteryVoltage', 'Temperature', 'Pressure', 'Heading', 'Pitch', 'Roll'].join(','),
  ]
  for (const record of records.value) {
    const line = [
      record.dateTime?.format('YYYY-MM-DDThh:mm:ss'),
      record.batteryVoltage?.toFixed(1),
      record.temperature?.toFixed(2),
      record.pressure?.toFixed(3),
      record.heading?.toFixed(1),
      record.pitch?.toFixed(1),
      record.roll?.toFixed(1),
    ]
    if (line.some((v) => v === undefined)) continue
    lines.push(line.join(','))
  }
  return lines.join('\n')
})

const gaugeLineWidth = 20
const ticksLineWidth = 10
</script>

<template>
  <div class="flex flex-col gap-8">
    <div class="flex">
      <div class="chart">
        <h3>Battery Voltage</h3>
        <VChart
          :option="{
            ...timeSeriesOptions,
            yAxis: { scale: true, axisLabel: { formatter: `{value}V` } },
            series: [
              {
                data: records
                  .filter(
                    (record) =>
                      record.dateTime !== undefined && record.batteryVoltage !== undefined,
                  )
                  .map((record) => [record.dateTime.valueOf(), record.batteryVoltage]),
                type: 'line',
              },
            ],
          }"
        />
      </div>
      <div class="chart">
        <h3>Water Temperature</h3>
        <VChart
          :option="{
            ...timeSeriesOptions,
            yAxis: { scale: true, axisLabel: { formatter: `{value}°C` } },
            series: [
              {
                data: records
                  .filter(
                    (record) => record.dateTime !== undefined && record.temperature !== undefined,
                  )
                  .map((record) => [record.dateTime.valueOf(), record.temperature]),
                type: 'line',
              },
            ],
          }"
        />
      </div>
      <div class="chart">
        <h3>Pressure</h3>
        <VChart
          group="timeSeries"
          :option="{
            ...timeSeriesOptions,
            yAxis: { scale: true, axisLabel: { formatter: `{value} Bar` } },
            series: [
              {
                data: records
                  .filter(
                    (record) => record.dateTime !== undefined && record.pressure !== undefined,
                  )
                  .map((record) => [record.dateTime.valueOf(), record.pressure * 1e-3]),
                type: 'line',
              },
            ],
          }"
        />
      </div>
    </div>
    <div class="flex">
      <div class="chart">
        <h3>Tilt Angle</h3>
        <VChart
          :option="{
            series: {
              type: 'gauge',
              startAngle: 90,
              endAngle: 0,
              min: 0,
              max: 90,
              center: ['30%', '90%'],
              radius: '170%',
              splitNumber: 3,
              splitLine: {
                length: ticksLineWidth,
                distance: -(ticksLineWidth + gaugeLineWidth) / 2,
              },
              axisTick: {
                splitNumber: 3,
                length: ticksLineWidth,
                distance: -(ticksLineWidth + gaugeLineWidth) / 2,
              },
              axisLabel: { distance: gaugeLineWidth + 10 },
              axisLine: {
                lineStyle: {
                  width: gaugeLineWidth,
                  color: data.tiltBins.map((frac, index) => [
                    (index + 0.5) / (data.tiltBins.length - 1),
                    `rgba(255, 0, 0, ${frac})`,
                  ]),
                },
              },
            },
          }"
        />
      </div>
      <div class="chart">
        <h3>Tilt Direction</h3>
        <VChart
          :option="{
            series: {
              type: 'gauge',
              startAngle: 0,
              endAngle: 360,
              min: 360,
              max: 0,
              radius: '90%',
              splitNumber: 4,
              splitLine: {
                length: ticksLineWidth,
                distance: -(ticksLineWidth + gaugeLineWidth) / 2,
              },
              axisTick: {
                splitNumber: 2,
                length: ticksLineWidth,
                distance: -(ticksLineWidth + gaugeLineWidth) / 2,
              },
              axisLabel: {
                distance: gaugeLineWidth + 10,
                formatter: (angle) => ({ 0: 'E', 90: 'N', 180: 'W', 270: 'S', 360: '' })[angle],
              },
              axisLine: {
                lineStyle: {
                  width: gaugeLineWidth,
                  color: data.dirBins.map((frac, index) => [
                    (index + 1) / data.dirBins.length,
                    `rgba(255, 0, 0, ${frac})`,
                  ]),
                },
              },
            },
          }"
        />
      </div>
      <div class="chart">
        <h3>Heading</h3>
        <VChart
          :option="{
            series: {
              type: 'gauge',
              startAngle: 0,
              endAngle: 360,
              min: 360,
              max: 0,
              radius: '90%',
              splitNumber: 4,
              splitLine: {
                length: ticksLineWidth,
                distance: -(ticksLineWidth + gaugeLineWidth) / 2,
              },
              axisTick: {
                splitNumber: 2,
                length: ticksLineWidth,
                distance: -(ticksLineWidth + gaugeLineWidth) / 2,
              },
              axisLabel: {
                distance: gaugeLineWidth + 10,
                formatter: (angle) => ({ 0: 'E', 90: 'N', 180: 'W', 270: 'S', 360: '' })[angle],
              },
              axisLine: {
                lineStyle: {
                  width: gaugeLineWidth,
                  color: data.headingBins.map((frac, index) => [
                    (index + 1) / data.headingBins.length,
                    `rgba(255, 0, 0, ${frac})`,
                  ]),
                },
              },
            },
          }"
        />
      </div>
    </div>
  </div>
  <RawData :data="rawData" class="mt-16" />
</template>

<style scoped>
@reference "./style.css";
div.chart {
  @apply w-fit;
}
div.chart > h3 {
  @apply text-sm text-center;
}
div.chart > .echarts {
  height: 150px;
  width: 300px;
}
</style>
