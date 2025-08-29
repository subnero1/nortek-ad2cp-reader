<script setup>
import { ref } from 'vue'
import MainPage from './MainPage.vue'
import LicensePage from '../build/LicensePage.vue'
const showLicense = ref(false)

// Injected from `npm run release`
const version = import.meta.env.VITE_APP_VERSION ?? 'dev-build'
</script>

<template>
  <div class="flex items-baseline justify-between">
    <div class="flex items-baseline gap-4">
      <h1>Nortek AD2CP Reader</h1>
      <span class="text-sm">{{ version }}</span>
    </div>
    <button class="btn btn-link text-neutral!" @click="showLicense = !showLicense">
      {{ !showLicense ? 'License' : 'Close' }}
    </button>
  </div>

  <KeepAlive>
    <MainPage v-if="!showLicense" />
    <LicensePage v-else />
  </KeepAlive>
</template>
