<script setup>
import { use } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import VChart from 'vue-echarts'

import RawData from './RawData.vue'
import { records } from './store.js'

use([SVGRenderer, LineChart, GridComponent, TooltipComponent, LegendComponent])
</script>

<template>
  <div class="flex flex-col items-start gap-8">
    <div class="chart">
      <h3>Wave Height</h3>
      <VChart
        :option="{
          xAxis: { type: 'time' },
          yAxis: {
            scale: true,
            min: 0,
            axisLabel: { formatter: `{value}m` },
          },
          grid: { containLabel: true, top: '10', bottom: 0, left: 0, right: 100 },
          tooltip: {
            trigger: 'axis',
            showContent: false,
            axisPointer: { type: 'cross' },
          },
          legend: { orient: 'vertical', top: 'middle', left: 'right', align: 'left' },
          series: [
            {
              name: 'Max',
              type: 'line',
              data: records
                .filter(
                  (record) =>
                    record.dateTime !== undefined && record.waveData?.heightMax !== undefined,
                )
                .map((record) => [record.dateTime.valueOf(), record.waveData.heightMax]),
            },
            {
              name: 'Top 10%',
              type: 'line',
              data: records
                .filter(
                  (record) =>
                    record.dateTime !== undefined && record.waveData?.height10 !== undefined,
                )
                .map((record) => [record.dateTime.valueOf(), record.waveData.height10]),
            },
            {
              name: 'Spectral',
              type: 'line',
              data: records
                .filter(
                  (record) =>
                    record.dateTime !== undefined && record.waveData?.height0 !== undefined,
                )
                .map((record) => [record.dateTime.valueOf(), record.waveData.height0]),
            },
            {
              name: 'Top 33%',
              type: 'line',
              data: records
                .filter(
                  (record) =>
                    record.dateTime !== undefined && record.waveData?.height3 !== undefined,
                )
                .map((record) => [record.dateTime.valueOf(), record.waveData.height3]),
            },
            {
              name: 'Mean',
              type: 'line',
              stack: 'band',
              data: records
                .filter(
                  (record) =>
                    record.dateTime !== undefined && record.waveData?.heightMean !== undefined,
                )
                .map((record) => [record.dateTime.valueOf(), record.waveData.heightMean]),
            },
          ],
        }"
      />
    </div>
    <div class="chart">
      <h3>Wave Period</h3>
      <VChart
        :option="{
          xAxis: { type: 'time' },
          yAxis: {
            scale: true,
            min: 0,
            axisLabel: { formatter: `{value}s` },
          },
          grid: { containLabel: true, top: '10', bottom: 0, left: 0, right: 100 },
          tooltip: {
            trigger: 'axis',
            showContent: false,
            axisPointer: { type: 'cross' },
          },
          legend: { orient: 'vertical', top: 'middle', left: 'right', align: 'left' },
          // color: ['black', '#5470c6', '#91cc75', '#fac858', 'black'],
          series: [
            {
              name: 'Mean',
              type: 'line',
              data: records
                .filter(
                  (record) =>
                    record.dateTime !== undefined && record.waveData?.periodMean !== undefined,
                )
                .map((record) => [record.dateTime.valueOf(), record.waveData.periodMean]),
            },
            {
              name: 'Peak',
              type: 'line',
              data: records
                .filter(
                  (record) =>
                    record.dateTime !== undefined && record.waveData?.periodPeak !== undefined,
                )
                .map((record) => [record.dateTime.valueOf(), record.waveData.periodPeak]),
            },
            {
              name: '1/3',
              type: 'line',
              data: records
                .filter(
                  (record) =>
                    record.dateTime !== undefined && record.waveData?.period1d3 !== undefined,
                )
                .map((record) => [record.dateTime.valueOf(), record.waveData.period1d3]),
            },
            {
              name: '1/10',
              type: 'line',
              data: records
                .filter(
                  (record) =>
                    record.dateTime !== undefined && record.waveData?.period1d10 !== undefined,
                )
                .map((record) => [record.dateTime.valueOf(), record.waveData.period1d10]),
            },
            {
              name: 'Max',
              type: 'line',
              data: records
                .filter(
                  (record) =>
                    record.dateTime !== undefined && record.waveData?.periodMax !== undefined,
                )
                .map((record) => [record.dateTime.valueOf(), record.waveData.periodMax]),
            },
            {
              name: 'Energy',
              type: 'line',
              data: records
                .filter(
                  (record) =>
                    record.dateTime !== undefined && record.waveData?.periodEnergy !== undefined,
                )
                .map((record) => [record.dateTime.valueOf(), record.waveData.periodEnergy]),
            },
          ],
        }"
      />
    </div>
  </div>
  <RawData
    class="mt-16"
    :data="
      [
        'Height0',
        'Height3',
        'Height10',
        'HeightMax',
        'HeightMean',
        'PeriodMean',
        'PeriodPeak',
        'PeriodZ',
        'Period1d3',
        'Period1d10',
        'PeriodMax',
        'PeriodEnergy',
      ].join(',') +
      '\n' +
      records
        .map((record) => [
          record.dateTime?.format('YYYY-MM-DDThh:mm:ss'),
          record.waveData?.height0?.toFixed(2),
          record.waveData?.height3?.toFixed(2),
          record.waveData?.height10?.toFixed(2),
          record.waveData?.heightMax?.toFixed(2),
          record.waveData?.heightMean?.toFixed(2),
          record.waveData?.periodPeak?.toFixed(2),
          record.waveData?.periodZ?.toFixed(2),
          record.waveData?.period1d3?.toFixed(2),
          record.waveData?.period1d10?.toFixed(2),
          record.waveData?.periodMax?.toFixed(2),
          record.waveData?.periodEnergy?.toFixed(2),
        ])
        .filter((row) => !row.some((v) => v === undefined))
        .map((row) => row.join(','))
        .join('\n')
    "
  />
</template>

<style scoped>
@reference "./style.css";
div.chart > h3 {
  @apply text-sm text-center;
}
div.chart > .echarts {
  height: 300px;
  width: 800px;
}
</style>
