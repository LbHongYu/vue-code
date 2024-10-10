<template>
  <main>
    <TheWelcome />
  </main>
</template>

<script setup lang="ts">
import TheWelcome from '../components/TheWelcome.vue'
import { mirrorWatch } from '@/common/mirror';

mirrorWatch.init({
  isReport: true,
  reportURL: '/api/test',
  systemId: 'VUE-CODE',
  timeout: 10000
});
</script>
