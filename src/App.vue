<script setup lang="ts">
import { RouterLink, RouterView, useRouter } from 'vue-router';

let route = useRouter();
function toPushPage (path) {
  route.push(path)
}

function toReplacePage (path) {
  route.replace(path)
}

function toGoPage () {
  history.go(-1)
}
</script>

<template>
  <header>
    <img alt="Vue logo" class="logo" src="@/assets/logo.svg" width="125" height="125" />

    <div class="wrapper">
      <nav>
        <div class="item" @click="toPushPage('/home')">toPushPage Home</div>
        <div class="item" @click="toPushPage('/about')">toPushPage About</div>
        <div class="item" @click="toReplacePage('/demo-1')">toReplacePage demo-1</div>
        <div class="item" @click="toGoPage()">toGo demo-1</div>
      </nav>
    </div>
  </header>

  <RouterView />
</template>

<style scoped>
header {
  line-height: 1.5;
  max-height: 100vh;
}

.logo {
  display: block;
  margin: 0 auto 2rem;
}

nav {
  width: 100%;
  font-size: 12px;
  text-align: center;
  margin-top: 2rem;
}

nav a.router-link-exact-active {
  color: var(--color-text);
}

nav a.router-link-exact-active:hover {
  background-color: transparent;
}

nav a {
  display: inline-block;
  padding: 0 1rem;
  border-left: 1px solid var(--color-border);
}

nav a:first-of-type {
  border: 0;
}

@media (min-width: 1024px) {
  header {
    display: flex;
    place-items: center;
    padding-right: calc(var(--section-gap) / 2);
  }

  .logo {
    margin: 0 2rem 0 0;
  }

  header .wrapper .item {
    cursor: pointer;
  }
  header .wrapper {
    display: flex;
    place-items: flex-start;
    flex-wrap: wrap;
    
  }

  nav {
    text-align: left;
    margin-left: -1rem;
    font-size: 1rem;

    padding: 1rem 0;
    margin-top: 1rem;
  }
}
</style>
