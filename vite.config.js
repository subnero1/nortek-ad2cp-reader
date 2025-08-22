import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { viteSingleFile } from 'vite-plugin-singlefile'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs/promises'
import { getProjectLicenses } from 'generate-license-file'

export default defineConfig({
  // prettier-ignore
  plugins: [
    vue(),
    vueDevTools(),
    viteSingleFile(),
    tailwindcss(),
    {
      name: 'generate-license-page', 
      async buildStart() {
        console.log('Generating license page...')
        const ourLicense = await fs.readFile('./LICENSE.md', 'utf-8')
        const thirdPartyLicenses = await getProjectLicenses("./package.json")
        await fs.writeFile(
          './dist/LicensePage.vue', 
`<template>
  <pre class="mt-0 text-neutral bg-base-100">${ourLicense}</pre>

  <div class="collapse collapse-arrow border border-base-300">
    <input type="checkbox" />
    <div class="collapse-title font-semibold">Third-Party Licenses</div>
    <div class="collapse-content text-sm overflow-x-auto">
  ${
    thirdPartyLicenses
      .map(
        (license) => 
`     <div class="mt-4">
        <h4 class="mt-0">${license.dependencies.join(', ')}</h4>
        <pre class="mt-0 ml-2 text-neutral bg-base-100">${license.content.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;')}</pre>
      </div>
`
      )
      .join('\n')
  }
    </div>
  </div>
</template>`
        )
      }
    }
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 3000,
  },
})
