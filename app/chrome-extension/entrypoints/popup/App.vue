<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RELAY_MESSAGE_TYPES } from '@/common/message-types';
import { loadLang, saveLang, translate, type Lang } from './i18n';
import { normalizeRelayUrl } from './normalizeRelayUrl';

interface RelaySnapshot {
  state: string;
  config: { url: string; login: string; token: string; enabled: boolean } | null;
  login: string;
  lastError: string | null;
  toolCount: number;
}

const lang = ref<Lang>('en');
const relayUrl = ref('');
const token = ref('');
const showToken = ref(false);
const state = ref('disconnected');
const login = ref('');
const lastError = ref<string | null>(null);
const toolCount = ref(0);
const formError = ref<string | null>(null);
const busy = ref(false);

const t = (key: Parameters<typeof translate>[1], subs?: string[]) =>
  translate(lang.value, key, subs);

const statusText = computed(() => {
  switch (state.value) {
    case 'connected':
      return t('statusConnected');
    case 'connecting':
      return t('statusConnecting');
    case 'authenticating':
      return t('statusAuthenticating');
    case 'reconnecting':
      return t('statusReconnecting');
    case 'error':
      return t('statusError');
    default:
      return t('statusDisconnected');
  }
});

const statusClass = computed(() =>
  state.value === 'connected'
    ? 'connected'
    : state.value === 'disconnected'
      ? 'disconnected'
      : 'pending',
);

const isConnected = computed(() => state.value === 'connected');

async function applySnapshot(snapshot: RelaySnapshot): Promise<void> {
  state.value = snapshot.state;
  login.value = snapshot.login || '';
  lastError.value = snapshot.lastError;
  toolCount.value = snapshot.toolCount || 0;
  if (snapshot.config?.url && !relayUrl.value) relayUrl.value = snapshot.config.url;
  if (snapshot.config?.token && !token.value) token.value = snapshot.config.token;
}

async function refresh(): Promise<void> {
  const snapshot = (await chrome.runtime.sendMessage({
    type: RELAY_MESSAGE_TYPES.GET_STATE,
  })) as RelaySnapshot | undefined;
  if (snapshot) await applySnapshot(snapshot);
}

async function connect(): Promise<void> {
  formError.value = null;
  const url = normalizeRelayUrl(relayUrl.value);
  if (!url) {
    formError.value = t('invalidUrl');
    return;
  }
  if (!token.value.trim()) {
    formError.value = t('tokenRequired');
    return;
  }

  busy.value = true;
  try {
    const result = await chrome.runtime.sendMessage({
      type: RELAY_MESSAGE_TYPES.CONNECT,
      url,
      token: token.value.trim(),
    });
    relayUrl.value = url;
    if (result && result.success === false) {
      lastError.value = result.error || t('statusError');
    }
    await refresh();
  } finally {
    busy.value = false;
  }
}

async function disconnect(): Promise<void> {
  busy.value = true;
  try {
    await chrome.runtime.sendMessage({ type: RELAY_MESSAGE_TYPES.DISCONNECT });
    await refresh();
  } finally {
    busy.value = false;
  }
}

async function switchLang(next: Lang): Promise<void> {
  lang.value = next;
  await saveLang(next);
}

onMounted(async () => {
  lang.value = await loadLang();
  await refresh();
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === RELAY_MESSAGE_TYPES.STATE_CHANGED && message.payload) {
      void applySnapshot(message.payload as RelaySnapshot);
    }
  });
});
</script>

<template>
  <div class="popup">
    <header class="header">
      <h1 class="title">Browser Relay</h1>
      <div class="lang-switch" :title="t('languageLabel')">
        <button
          type="button"
          :class="{ active: lang === 'en' }"
          :aria-pressed="lang === 'en'"
          @click="switchLang('en')"
        >
          EN
        </button>
        <button
          type="button"
          :class="{ active: lang === 'ru' }"
          :aria-pressed="lang === 'ru'"
          @click="switchLang('ru')"
        >
          RU
        </button>
      </div>
    </header>

    <section class="status">
      <span class="dot" :class="statusClass"></span>
      <span class="status-text">{{ statusText }}</span>
      <span v-if="isConnected" class="status-meta">{{ t('toolsCount', [String(toolCount)]) }}</span>
    </section>

    <section class="form">
      <label class="label" for="relay-url">{{ t('relayUrlLabel') }}</label>
      <input
        id="relay-url"
        v-model="relayUrl"
        class="input"
        type="text"
        spellcheck="false"
        autocomplete="off"
        :placeholder="t('relayUrlPlaceholder')"
        @input="formError = null"
      />

      <label class="label" for="relay-token">{{ t('tokenLabel') }}</label>
      <div class="token-row">
        <input
          id="relay-token"
          v-model="token"
          class="input"
          :type="showToken ? 'text' : 'password'"
          spellcheck="false"
          autocomplete="off"
          :placeholder="t('tokenPlaceholder')"
          @input="formError = null"
        />
        <button
          type="button"
          class="ghost"
          :title="showToken ? t('hideToken') : t('showToken')"
          :aria-label="showToken ? t('hideToken') : t('showToken')"
          @click="showToken = !showToken"
        >
          <svg v-if="showToken" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path
              d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M6.3 6.3C4.2 7.6 2.7 9.6 2 12c1.7 4.1 5.4 7 10 7 1.6 0 3.1-.4 4.4-1.1M17.9 17.9c2-1.3 3.4-3.3 4.1-5.9-1.7-4.1-5.4-7-10-7-1 0-1.9.2-2.8.5"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
            />
          </svg>
          <svg v-else viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path
              d="M2 12s3.7-7 10-7 10 7 10 7-3.7 7-10 7S2 12 2 12z"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
            />
            <circle cx="12" cy="12" r="2.6" fill="none" stroke="currentColor" stroke-width="1.6" />
          </svg>
        </button>
      </div>

      <p v-if="formError" class="error">{{ formError }}</p>

      <button v-if="!isConnected" type="button" class="primary" :disabled="busy" @click="connect">
        {{ t('connect') }}
      </button>
      <button v-else type="button" class="secondary" :disabled="busy" @click="disconnect">
        {{ t('disconnect') }}
      </button>
    </section>

    <section v-if="isConnected && login" class="session">
      <span class="label">{{ t('sessionLabel') }}</span>
      <span class="session-value">{{ login }}</span>
    </section>

    <section v-if="lastError" class="last-error">
      <span class="label">{{ t('lastErrorLabel') }}</span>
      <p class="error">{{ lastError }}</p>
    </section>
  </div>
</template>
