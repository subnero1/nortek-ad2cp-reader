<script setup>
import { ref } from 'vue'
import MainPage from './MainPage.vue'
import LicensePage from '../dist/LicensePage.vue'
const showLicense = ref(false)
</script>

<template>
  <div class="flex items-baseline justify-between">
    <h1>Nortek AD2CP Reader</h1>
    <button class="btn btn-link text-neutral!" @click="showLicense = !showLicense">
      {{ !showLicense ? 'License' : 'Close' }}
    </button>
  </div>

  <KeepAlive>
    <MainPage v-if="!showLicense" />
    <LicensePage v-else />
  </KeepAlive>
</template>
