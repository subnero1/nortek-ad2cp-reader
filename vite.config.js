import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { viteSingleFile } from 'vite-plugin-singlefile'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import fsp from 'node:fs/promises'
import { getProjectLicenses } from 'generate-license-file'

const buildPath = './build'
const generatedLicensePath = path.join(buildPath, 'LicensePage.vue')

export default defineConfig({
  // prettier-ignore
  plugins: [
    vue(),
    vueDevTools(),
    viteSingleFile(),
    tailwindcss(),
    {
      name: 'generate-license-page', 
      buildStart: async () => {
        console.log('Creating build folder...')
        await fsp.mkdir(buildPath, { recursive: true })

        console.log('Generating license page...')
        const ourLicense = await fsp.readFile('./LICENSE.md', 'utf-8')
        const thirdPartyLicenses = await getProjectLicenses("./package.json")
        await fsp.writeFile(
          generatedLicensePath, 
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
      },
      closeBundle: async () => {
        console.log('Removing build folder...')
        await fsp.rm(buildPath, { recursive: true, force: true })
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
  build: {
    rollupOptions: {
      input: {
        app: './nortek-ad2cp-reader.html',
      },
    },
  },
})
