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
  const xyDirBins = Array.from({ length: 180 }, () => 0)
  const compassDirBins = Array.from({ length: 180 }, () => 0)
  const headingBins = Array.from({ length: 180 }, () => 0)

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

      const xyDir = (180 / Math.PI) * Math.atan2(-sinRoll, sinPitch * cosRoll)
      xyDirBins[Math.floor((xyDirBins.length / 360) * (xyDir + 180))] += 1

      const compassDir =
        (180 / Math.PI) *
        Math.atan2(
          sinHeading * sinPitch * cosRoll - cosHeading * sinRoll,
          cosHeading * sinPitch * cosRoll + sinHeading * sinRoll,
        )
      compassDirBins[Math.floor((compassDirBins.length / 360) * (compassDir + 180))] += 1

      headingBins[Math.floor((headingBins.length / 360) * (heading - 90))] += 1
    }
  }
  const tiltBinsMax = Math.max(...tiltBins)
  const xyDirBinsMax = Math.max(...xyDirBins)
  const compassDirBinsMax = Math.max(...compassDirBins)
  const headingBinsMax = Math.max(...headingBins)
  return {
    tiltBins: tiltBins.map((count) => count / tiltBinsMax),
    xyDirBins: xyDirBins.map((count) => count / xyDirBinsMax),
    compassDirBins: compassDirBins.map((count) => count / compassDirBinsMax),
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

        <div class="flex flex-row smaller-charts">
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
                  formatter: (angle) => ({ 0: 'X', 90: 'Y', 180: '', 270: '', 360: '' })[angle],
                },
                axisLine: {
                  lineStyle: {
                    width: gaugeLineWidth,
                    color: data.xyDirBins.map((frac, index) => [
                      (index + 1) / data.xyDirBins.length,
                      `rgba(255, 0, 0, ${frac})`,
                    ]),
                  },
                },
              },
            }"
          />
          <VChart
            :option="{
              series: {
                type: 'gauge',
                startAngle: 90,
                endAngle: 450,
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
                  formatter: (angle) => ({ 0: 'N', 90: 'W', 180: 'S', 270: 'E', 360: '' })[angle],
                },
                axisLine: {
                  lineStyle: {
                    width: gaugeLineWidth,
                    color: data.compassDirBins.map((frac, index) => [
                      (index + 1) / data.compassDirBins.length,
                      `rgba(255, 0, 0, ${frac})`,
                    ]),
                  },
                },
              },
            }"
          />
        </div>
      </div>
      <div class="chart">
        <h3>Heading (y axis)</h3>
        <VChart
          :option="{
            series: {
              type: 'gauge',
              startAngle: 90,
              endAngle: 450,
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
                formatter: (angle) => ({ 0: 'N', 90: 'W', 180: 'S', 270: 'E', 360: '' })[angle],
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
div.smaller-charts > .echarts {
  height: 150px;
  width: 150px;
}
</style>
