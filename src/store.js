import { ref, computed } from 'vue'

export const records = ref([])

export const counts = computed(() => {
  const types = {}
  for (const record of records.value) {
    types[record.dataSeriesId] = (types[record.dataSeriesId] || 0) + 1
  }
  return types
})
