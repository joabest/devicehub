# DeviceHub — Documentação Técnica da Arquitetura do Frontend

> Documento de análise arquitetural do frontend (`/ui`). Objetivo: compreender
> completamente a aplicação **antes** de qualquer refatoração visual. Nenhum
> comportamento ou arquivo de código foi alterado para produzir este documento.

DeviceHub é um fork do **OpenSTF / Smartphone Test Farm**: uma plataforma para
controlar remotamente dispositivos Android/iOS reais conectados a um servidor. O
frontend é uma **SPA** que se conecta ao backend STF via **HTTP (REST)**,
**WebSocket de streaming de tela** e **Socket.IO de eventos/comandos**.

---

## 1. Visão Geral da Arquitetura

### 1.1 Tecnologias utilizadas

| Categoria | Tecnologia | Observações |
|---|---|---|
| Build / bundler | **Vite 6** + `@vitejs/plugin-react-swc` | Modos: `development`, `mock`, `preview`, `staging`, `production` |
| Linguagem | **TypeScript 5.5** | `strict`, paths `@/*` via `vite-tsconfig-paths` |
| UI framework | **React 18.3** | `StrictMode`, sem SSR |
| Design system | **@vkontakte/vkui 7** (VKUI) + `@vkontakte/icons` | Base visual da VK; tema claro/escuro nativo |
| Roteamento | **react-router 7** | `createHashRouter` (rotas em hash `#/...`) |
| Estado servidor | **@tanstack/react-query 5** | Cache de dados de API |
| Estado local | **MobX 6** + `mobx-react-lite` + `mobx-persist-store` | Stores observáveis |
| Injeção de dependência | **InversifyJS 6** + `inversify-react` | Containers hierárquicos (global + por dispositivo) |
| Tabelas | **@tanstack/react-table 8** + `@tanstack/react-virtual` | Ordenação, filtro fuzzy, virtualização |
| HTTP | **axios** | Clients com interceptadores |
| Realtime | **socket.io-client 4** + **WebSocket nativo** | Eventos/comandos + streaming de tela |
| i18n | **i18next** + `react-i18next` + http-backend + language-detector | 13 idiomas |
| Mock / testes | **MSW 2** (mock) + **Vitest 3** + Testing Library | `--mode mock` |
| Geração de código | **orval** (API a partir de OpenAPI) + **plop** (scaffolding) | Gera `src/generated` |
| Datas | **date-fns** | |
| Utilidades | **lodash**, **classnames** | |

### 1.2 Estrutura do projeto (monorepo lógico)

```
/ (raiz)  → backend Node.js do STF (fora do escopo deste doc)
/ui       → frontend SPA (foco deste documento)
```

Dentro de `/ui`:

```
ui/
├── index.html                  # HTML de entrada (título, favicon, manifest)
├── vite.config.ts              # Config Vite (proxy /proxy-api → backend)
├── package.json                # Deps e scripts
├── public/                     # Assets estáticos + mockServiceWorker.js
└── src/                        # Código-fonte (detalhado na seção 2)
```

### 1.3 Fluxo da aplicação (alto nível)

```
index.html
  └─ carrega /src/main.tsx
       └─ createRootWithProviders(<App />)
            ├─ enableMocking()            # ativa MSW se MODE === 'mock'
            └─ ReactDOM.createRoot().render(
                 <StrictMode>
                   <QueryClientProvider>          # React Query
                     <DIContainerProvider>        # Inversify (globalContainer)
                       <ThemeProvider>            # tema claro/escuro/sistema
                         <AppWrapper>             # VKUI (ConfigProvider/AppRoot) + Toast
                           <App />                # RouterProvider(appRouter)
```

### 1.4 Pontos de entrada

Existem **três** pontos de entrada (roots), montados pelo mesmo
`createRootWithProviders`:

1. **`src/main.tsx`** → `<App />` — a aplicação principal (o SPA logado).
2. **`src/roots/auth-mock.tsx`** → `<AuthMockPage />` — página de login "mock".
3. **`src/roots/auth-ldap.tsx`** → `<AuthLdapPage />` — página de login LDAP.

> Os roots de auth são páginas HTML separadas servidas pelo backend STF em
> `/auth/mock` e `/auth/ldap`. O SPA principal delega a autenticação a essas
> páginas (ver seções 3 e 7).

### 1.5 Inicialização da aplicação

`src/create-root-with-providers.tsx` centraliza o bootstrap. Ordem de efeitos:

1. Importa estilos globais: tema VKUI (`themes.css`), `@/styles/index.css` e
   inicializa i18n (`@/config/i18n/i18n`).
2. `enableMocking()` — resolve uma Promise; se `MODE === 'mock'`, inicia o
   service worker do MSW antes de renderizar.
3. Cria a árvore de providers e renderiza o `children` (App ou página de auth).

---

## 2. Estrutura de Pastas (`ui/src`)

Contagem aproximada: **~738 arquivos**. Diretórios de primeiro nível:

### `api/` — Camada de comunicação com o backend
- **Finalidade:** clients axios, rotas, tipos e interceptadores. Subpastas:
  `auth/` (login), `openstf/` (endpoints "legados" do STF), `openstf-api/`
  (API principal), além de `socket.ts` (Socket.IO) e `interceptors.ts`.
- **Dependências:** axios, socket.io-client, `variables.config`, `auth-store`.
- **Quem usa:** `config/queries` (React Query), stores e services.
- **Importância:** 🔴 Crítica. Contrato com o backend.

### `assets/` — Recursos estáticos importáveis
- **Finalidade:** SVGs (logos `device-hub.svg`, `emulator-hub.svg`), ícones de
  navegadores (`browser-icons/`), imagens. Importados como componentes via
  `vite-plugin-svgr` (`?react`).
- **Quem usa:** `dynamic-logo`, células de tabela, control panel.
- **Importância:** 🟡 Média (relevante para rebranding — seção 9).

### `components/` — Toda a camada de UI (~356 arquivos)
Subdividida em:
- **`app/`** — bootstrap de UI: `app.tsx` (RouterProvider), `app-router/`
  (rotas + guarda de auth + error boundary), `providers/theme-provider/`.
- **`layouts/`** — `main-layout.tsx` (Header + AlertMarquee + `<Outlet/>`).
- **`lib/`** — **componentes genéricos reutilizáveis** (~40 pastas): `base-modal`,
  `base-select`, `content-card`, `statistic-card`, `table-with-sticky-header`,
  `tabs-panel`, `dynamic-logo`, `conditional-render`, `error-toast`, etc.
- **`ui/`** — **componentes de domínio** (específicos do DeviceHub): `header`,
  `device-table`, `device-statistics`, `device` (tela do dispositivo),
  `device-control-panel` (abas de controle), `settings-tabs`, `modals`,
  `search-device`, `theme-switcher`, `lang-switcher`, etc.
- **`views/`** — **páginas de rota**: `auth`, `devices-page`, `control-page`,
  `groups-page`, `settings-page`. Cada uma tem versão `*.async.tsx` (lazy).
- **Importância:** 🔴 Crítica (é onde a refatoração visual acontece).

### `config/` — Configuração central
- **`i18n/i18n.ts`** — setup do i18next e lista de idiomas suportados.
- **`inversify/`** — DI: `container-ids.ts` (símbolos), `global-container.ts`
  (bindings globais), `create-device-container.ts` (container por dispositivo),
  `decorators.ts` (`@deviceConnectionRequired`).
- **`queries/`** — `query-client.ts` (QueryClient) e `query-key-store.ts` (todas
  as query keys/fns centralizadas via `@lukemorales/query-key-factory`).
- **`variables.config.ts`** — URLs de API/WebSocket por ambiente.
- **Importância:** 🔴 Crítica.

### `constants/` — Constantes da aplicação
- `route-paths.ts` (todas as rotas), `keyboard-keys-map.ts`, enums de colunas,
  etc. **Importância:** 🟡 Média-alta (`route-paths` é referência de navegação).

### `generated/` — Código gerado por orval (~144 arquivos)
- **Finalidade:** tipos e schemas derivados do OpenAPI do backend (`types/`).
- **Importância:** 🔴 Crítica — **não editar manualmente** (regenerado).

### `lib/` — Hooks e utilitários (~81 arquivos)
- **`hooks/`** — hooks React (`use-theme`, `use-debounce`, `use-mock-auth`,
  `use-get-auth-url`, etc.).
- **`utils/`** — funções puras (`throttle`, `get-device-state`,
  `is-device-usable`, `resolve-table-filter-value`, etc.).
- **Importância:** 🟢 Reutilização transversal.

### `roots/` — Pontos de entrada alternativos
- `auth-mock.tsx`, `auth-ldap.tsx` (ver seção 1.4).

### `services/` — Lógica de negócio orientada a serviços (~37 arquivos)
- Classes Inversify que encapsulam operações: `settings-service`,
  `group-service`, `access-token-service`, `adb-key-service`,
  `logs-tracker-service`, `touch-service`, `scaling-service`,
  `keyboard-service`, `port-forwarding-service`, `save-logs-service`,
  `application-installation`, `file-explorer-service`, e o **core**
  `device-control-service` (envia comandos ao dispositivo).
- **Importância:** 🔴 Crítica (comportamento — não mexer numa refatoração visual).

### `store/` — Estado MobX (~17 arquivos)
- Stores globais e por dispositivo: `auth-store`, `current-user-profile-store`,
  `device-list-store`, `device-table-state`, `device-screen-store/`,
  `device-control-store`, `device-connection`, `device-by-serial-store`,
  `global-toast`, `link-opener-store`, `logs-table-state`, além de wrappers
  `mobx-query` e `mobx-mutation` (integração MobX ↔ React Query).
- **Importância:** 🔴 Crítica.

### `styles/` — Estilos globais
- `index.css` (entrada), `reset.css`, `variables/global.css` (tokens CSS custom:
  z-index, tamanhos, cores auxiliares). **Importância:** 🟡 Alta para tema.

### `types/` — Tipos TypeScript manuais (~33 arquivos)
- Tipos de domínio não gerados: `list-device.type`, `device-table-row.type`,
  `device-change-message.type`, enums (`device-state.enum`), etc.
- **Importância:** 🟡 Média-alta.

---

## 3. Fluxo da Aplicação (detalhado)

```
┌──────────┐
│ Usuário  │
└────┬─────┘
     │ acessa a URL do DeviceHub
     ▼
┌─────────────────────────────────────────────────────────────┐
│ RequireAuth (components/app/app-router/require-auth.tsx)      │
│  - lê ?jwt= da query string                                   │
│  - se não há jwt e não autenticado → redireciona para /auth   │
│    (openStfApiHostUrl + getAuthRoute())                        │
└────┬──────────────────────────────────────────────────────────┘
     │ (jwt presente / já autenticado)
     ▼
┌─────────────────────────────────────────────────────────────┐
│ LOGIN — página servida pelo backend (/auth/mock ou /auth/ldap)│
│  - roots/auth-mock.tsx  → AuthMockPage                         │
│  - roots/auth-ldap.tsx  → AuthLdapPage                         │
│  - useMockAuth / useLdapAuth chamam a API de auth,             │
│    recebem um JWT e redirecionam de volta com ?jwt=<token>     │
└────┬──────────────────────────────────────────────────────────┘
     │ authStore.login(jwt) → persiste em localStorage (chave "jwt")
     ▼
┌─────────────────────────────────────────────────────────────┐
│ MainLayout (Header + AlertMarquee + <Outlet/>)                │
└────┬──────────────────────────────────────────────────────────┘
     ▼
┌─────────────────────────────────────────────────────────────┐
│ DASHBOARD / LISTA DE DISPOSITIVOS  (rota "/" e "/devices")    │
│  DevicesPage → DeviceStatistics (cards) + SearchDevice +      │
│  TableColumnVisibility + DeviceTable                          │
│  - getListDevices() via React Query (staleTime: Infinity)     │
│  - socket 'device.change' atualiza linhas em tempo real       │
└────┬──────────────────────────────────────────────────────────┘
     │ usuário clica "Use" em um dispositivo → navega p/ /control/:serial
     ▼
┌─────────────────────────────────────────────────────────────┐
│ SESSÃO REMOTA  (rota "/control/:serial")                      │
│  ControlPage cria um DI container isolado por serial          │
│  (createDeviceContainer) → resolve DeviceScreenStore,         │
│  DeviceControlStore, TouchService, etc.                       │
│  DeviceConnection.useDevice():                                │
│    - startRemoteConnect() (socket 'connect.start')            │
│    - groupService.invite(serial, channel, group)              │
│    - gera debugCommand (adb/sdb/curl connect)                 │
└────┬──────────────────────────────────────────────────────────┘
     ▼
┌─────────────────────────────────────────────────────────────┐
│ CONTROLE DO DISPOSITIVO                                        │
│  Esquerda: <Device> → device-screen (canvas + streaming WS)   │
│  Direita:  <DeviceControlPanel> → abas (dashboard, logs,      │
│            advanced, file-explorer, info)                     │
│  - Streaming: WebSocket em device.display.url                 │
│    (subprotocolo access_token.<jwt>) → frames como Blob →     │
│    ImageBitmap → canvas (bitmaprenderer)                       │
│  - Comandos: TouchService traduz mouse/touch em input.* e     │
│    envia via socket.emit (DeviceControlService)               │
└─────────────────────────────────────────────────────────────┘
```

**Passos explicados:**
1. **Guarda de rota** (`RequireAuth`): observa `authStore`; sem token válido,
   manda o navegador para a página de auth do backend. Aceita `?jwt=` na URL
   como mecanismo de handoff pós-login.
2. **Login:** páginas independentes (roots) autenticam e devolvem o JWT.
3. **Persistência:** `authStore` guarda o JWT em `localStorage` (mobx-persist).
   Todo request HTTP anexa `Authorization: Bearer <jwt>`.
4. **Lista:** dados via React Query; atualizações incrementais via Socket.IO
   (`device.change`) com _throttle_ de 250 ms e _batch_ de updates.
5. **Sessão:** container Inversify por dispositivo isola stores/serviços daquele
   `serial`, permitindo múltiplas sessões independentes.
6. **Controle:** streaming por WebSocket dedicado; input do usuário convertido
   em mensagens de protocolo STF e emitido via Socket.IO.

---

## 4. Sistema de Rotas

Definido em `components/app/app-router/app-router.tsx` com **`createHashRouter`**
(URLs no formato `#/...`). Todas passam por `ErrorBoundaryElement` → `RequireAuth`
→ `MainLayout`.

| Rota | Componente | Layout | Permissões | Principais chamadas de API |
|---|---|---|---|---|
| `/` | `DevicesPage` | MainLayout | Autenticado | `getListDevices`, `getCurrentUserProfile` |
| `/devices` | `DevicesPage` | MainLayout | Autenticado | idem `/` |
| `/control/:serial` | `ControlPage` | MainLayout | Autenticado + sessão do device | `getDeviceBySerial`, `connect.start`, streaming WS |
| `/control/:serial/logs` | `ControlPage` (aba) | MainLayout | Autenticado | `logcat.start/stop` |
| `/control/:serial/advanced` | `ControlPage` (aba) | MainLayout | Autenticado | `forward.*`, `shell.command` |
| `/control/:serial/file-explorer` | `ControlPage` (aba) | MainLayout | Autenticado | `fs.list`, `fs.retrieve` |
| `/control/:serial/info` | `ControlPage` (aba) | MainLayout | Autenticado | `getDeviceBySerial` |
| `/settings` | `SettingsPage` (General) | MainLayout | Autenticado | settings services |
| `/settings/keys` | `SettingsPage` (Keys) | MainLayout | Autenticado | `getAccessTokens`, `getAdbRange` |
| `/settings/groups` | `SettingsPage` (Groups) | MainLayout | Autenticado | `getGroups`, `getUsersInGroup` |
| `/settings/teams` | `SettingsPage` (Teams) | MainLayout | **Admin** | `getTeams`, `getTeamUsers`, `getTeamGroups` |
| `/settings/devices` | `SettingsPage` (Devices) | MainLayout | **Admin** | `getSettingsDevices` |
| `/settings/users` | `SettingsPage` (Users) | MainLayout | **Admin** | `getSettingsUsers` |
| `/settings/shell` | `SettingsPage` (Shell) | MainLayout | **Admin** | `getShellDevices` |
| `/groups` | `GroupsPage` | MainLayout | Autenticado | `getGroupDevices` |
| `*` | `Navigate → /devices` | — | — | — |

**Rotas de autenticação** (fora do SPA principal, páginas próprias):
`/auth`, `/auth/mock`, `/auth/ldap` (ver `route-paths.ts` e `roots/`).

**Permissões:** derivadas de `currentUserProfileStore.isAdmin`; as abas de
Settings marcadas como Admin recebem `disabled` quando o usuário não é admin
(ver `settings-page.tsx`). A guarda de rota em si só verifica autenticação.

---

## 5. Componentes (principais)

### Componentes de página (`components/views`)
| Componente | Responsabilidade | Props | Dependências | Reutilização |
|---|---|---|---|---|
| `DevicesPage` | Dashboard: estatísticas + tabela de dispositivos | — | VKUI, `deviceTableState`, `DeviceTable`, `DeviceStatistics` | Rota |
| `ControlPage` | Sessão remota; cria DI container por device; split view | — (usa `useParams().serial`) | `react-split`, Inversify, `Device`, `DeviceControlPanel` | Rota |
| `SettingsPage` | Abas de configuração com sync de rota | — | `TabsPanel`, tabs de settings, `currentUserProfileStore` | Rota |
| `GroupsPage` | Gestão de grupos/agendamento | — | group services | Rota |
| `AuthMockPage`/`AuthLdapPage` | Formulários de login | — | hooks de auth, `authStore` | Roots |

### Componentes de domínio (`components/ui`)
| Componente | Responsabilidade | Dependências |
|---|---|---|
| `Header` | Navegação (logo, Devices, Settings), suporte/help, logout | `authStore`, hooks de auth URL, `DynamicLogo` |
| `DeviceStatistics` | 4 cards (Total, Usable, Busy, "usando"/perfil) | `deviceListStore`, `currentUserProfileStore`, `StatisticCard` |
| `DeviceTable` | Tabela com ordenação/filtro fuzzy/virtualização | `@tanstack/react-table`, `deviceListStore`, `deviceTableState` |
| `Device` / `device-screen` | Canvas + streaming de tela + navegação | `DeviceScreenStore`, `TouchService`, `ScalingService` |
| `DeviceControlPanel` | Abas de controle do dispositivo | services do device container |
| `SearchDevice` | Busca/filtro da lista | `deviceTableState` |
| `TableColumnVisibility` | Mostrar/ocultar colunas | `deviceTableState` |
| `ThemeSwitcher` / `LangSwitcher` | Troca tema / idioma | `useTheme`, i18next |

### Componentes genéricos (`components/lib`)
`StatisticCard`, `ContentCard`, `BaseModal`, `BaseSelect`, `TabsPanel`,
`TableWithStickyHeader`, `ConditionalRender`, `DynamicLogo`, `ErrorToast`,
`CopyableBlock`, `OutputLogArea`, `ProgressBar`, `Marquee`, etc.
São **agnósticos de domínio** e a base ideal para padronização visual.

> Padrão recorrente: quase todo componente que lê estado é `observer(...)` do
> MobX e injeta serviços/stores via `useInjection(CONTAINER_IDS.x)`.

---

## 6. Estado da Aplicação

O DeviceHub usa **duas camadas de estado combinadas**:

### 6.1 MobX (estado de UI / lógica de negócio)
- `makeAutoObservable` / `makeObservable` em stores e services.
- Componentes reagem via `observer()` (`mobx-react-lite`).
- **Persistência:** `mobx-persist-store` (ex.: `authStore` → `localStorage["jwt"]`).
- Stores globais (singleton no `globalContainer`): `DeviceListStore`,
  `CurrentUserProfileStore`, `SettingsService`, etc.
- Stores/objetos globais fora do DI: `authStore`, `globalToast`,
  `deviceErrorModalStore`, `deviceTableState`, `logsTableState`.
- Stores por dispositivo (no container do `serial`): `DeviceScreenStore`,
  `DeviceControlStore`, `DeviceConnection`, `DeviceBySerialStore`,
  `ShellControlStore`, `LinkOpenerStore`.

### 6.2 TanStack React Query (estado de servidor)
- `QueryClient` único (`config/queries/query-client.ts`).
- Todas as chaves/funções centralizadas em `query-key-store.ts`.
- Wrappers `MobxQuery` e `MobxMutation` fazem a ponte para que stores MobX
  consumam queries de forma observável (fábricas registradas no Inversify:
  `factoryMobxQuery`, `factoryMobxMutation`).

### 6.3 Context API (pontual)
- `ThemeProvider` (`ThemeContext`) — apenas tema (claro/escuro/sistema).

### 6.4 Não utilizados
- **Redux, Zustand, Recoil, Jotai:** ❌ não presentes.

**Resumo:** estado de servidor → React Query; estado de UI/negócio → MobX +
Inversify; tema → Context. Não há Redux/Zustand.

---

## 7. Comunicação com Backend

### 7.1 Camada HTTP (axios)
Três clients axios, cada um com `baseURL` = `openStfApiHostUrl` do ambiente:
- `api/auth/auth-client.ts` — endpoints de autenticação.
- `api/openstf/openstf-client.ts` — endpoints "legados" do STF.
- `api/openstf-api/openstf-api-client.ts` — API principal.

Em `development`/`mock`, `openStfApiHostUrl = '/proxy-api'` e o Vite faz proxy
para o backend real (porta 7100). Em `production`/`staging`, usa
`window.location.origin`.

### 7.2 Autenticação
- JWT persistido em `authStore` (localStorage).
- Interceptador **de request** `attachTokenOnRequest` adiciona
  `Authorization: Bearer <jwt>` a toda chamada.
- Não há fluxo de **refresh token** no frontend: expiração/401 leva a logout.

### 7.3 Interceptadores (`api/interceptors.ts`)
- `attachTokenOnRequest` — injeta o Bearer token.
- `logoutOnErrorResponse` — em **HTTP 401**, chama `authStore.logout()`.
- `extractMessageOnErrorResponse` — extrai `description`/`message` do erro e
  dispara `globalToast` (toast global de erro).

### 7.4 Tratamento de erro
- Toast global via `globalToast` + `ErrorToast` (montado no `AppWrapper`).
- `ErrorBoundaryElement` (react-error-boundary) envolve rotas.
- Erros de sessão de dispositivo → `deviceErrorModalStore` → `ErrorModal`.

### 7.5 Realtime
Há **dois canais realtime distintos**:

**(a) Socket.IO** (`api/socket.ts`) — eventos e comandos:
- Conecta em `websocketUrl` (`http://localhost:7110` em dev).
- `autoConnect: false`, `reconnectionAttempts: 3`, transporte `websocket`.
- Auth via handshake: `auth: cb => cb({ token: authStore.jwt })`.
- Eventos de entrada: `device.change` (atualização da lista).
- Comandos de saída: `socket.emit(action, channel, [transactionChannel], data)`
  em `DeviceControlService` (ver seção 8).

**(b) WebSocket nativo** — streaming de tela (ver seção 8).

### 7.6 Polling / Signaling
- **Polling:** não é o padrão; a atualização da lista é _push_ via Socket.IO.
  React Query usa `staleTime: Infinity` para a lista (sem refetch automático).
- **Signaling:** o streaming não usa WebRTC/SDP; usa um protocolo próprio de
  texto/binário sobre WebSocket (mensagens `start`, `size WxH`, `on`/`off`,
  frames Blob).

---

## 8. Sessão Remota (streaming + comandos)

### 8.1 Como o frontend inicia a sessão
1. Rota `/control/:serial` monta `ControlPage`.
2. `ControlPage` cria um **container Inversify isolado** via
   `createDeviceContainer(serial)` — o `serial` é injetável e os stores/services
   são singletons **daquela sessão**.
3. `DeviceConnection.useDevice()`:
   - `deviceControlStore.startRemoteConnect()` → `socket.emit('connect.start', ...)`.
   - `groupService.invite(serial, channel, group)` — reserva o dispositivo.
   - Monta o `debugCommand` (`adb connect` / `sdb connect` / `curl` por
     plataforma) para debug externo.

### 8.2 Qual componente abre o viewer
- `ControlPage` renderiza, à esquerda, o componente **`<Device>`**, que contém
  **`device-screen`** (o canvas). À direita, `<DeviceControlPanel>` com as abas.
  O layout é um split ajustável (`react-split`, tamanhos `[30, 70]`).

### 8.3 Como o streaming é recebido (`store/device-screen-store`)
- `startScreenStreaming(canvas, wrapper)` obtém o contexto
  `canvas.getContext('bitmaprenderer')` e chama `connectWebsocket()`.
- **WebSocket nativo** aberto em `device.display.url`, passando o JWT via
  **subprotocolo**: `new WebSocket(url, `access_token.${jwt}`)`.
- Mensagens:
  - **Blob** → `createImageBitmap` → `context.transferFromImageBitmap(image)`
    (renderiza o frame no canvas).
  - **`start {...}`** → define orientação/rotação inicial.
  - **`secure_on`** → tela marcada como segura (não exibível).
  - **JSON `auth_success`/`auth_error`** → confirma autenticação do socket.
- **Área de interesse:** envia `size WxH`, `on`, `off` conforme visibilidade da
  aba, dimensões do container e estado do stream (economia de banda).
- **Reconexão:** até 3 tentativas a cada 5s; código de close `1008` →
  "Unauthorized"; falha final → "Service is currently unavailable"
  (via `deviceErrorModalStore`).

### 8.4 Como os comandos são enviados ao backend
- **Entrada de toque/mouse:** `TouchService` converte eventos do DOM
  (`mouseDown/Move/Up`, `touchStart/Move/End`) em coordenadas escaladas
  (`ScalingService`, considerando rotação e retina) e chama métodos do
  `DeviceControlStore` (`touchDown`, `touchMove`, `touchUp`, `touchCommit`,
  `gestureStart/Stop`) — suporta multitouch (slots) e "fake pinch" com Alt.
- **`DeviceControlService`** (core) expõe a API de comandos:
  - **One-way** (`sendOneWay`): `socket.emit(action, device.channel, data)` —
    ex.: `input.touchDown`, `input.type`, `display.rotate`, `quality.change`,
    teclas (`input.keyPress` para home/back/volume/etc.).
  - **Two-way** (`sendTwoWay`): cria uma **transação** (`TransactionService`),
    emite `socket.emit(action, channel, transactionChannel, data)` e devolve uma
    Promise resolvida quando o backend responde no canal da transação — ex.:
    `clipboard.copy/paste`, `fs.list/retrieve`, `device.install/uninstall`,
    `device.launchApp`, `logcat.start/stop`, `forward.*`, `shell.command`,
    `device.reboot`, `app.*`.
  - **iOS:** ações ganham sufixo `Ios` automaticamente quando
    `manufacturer === 'Apple'`.

---

## 9. Tema e Identidade Visual

### 9.1 Onde ficam as cores
- **Base:** tokens do **VKUI** (`@vkontakte/vkui/dist/cssm/styles/themes.css`),
  usados como `var(--vkui--color_accent_azure)`, `var(--vkui--color_accent_violet)`,
  `var(--vkui_internal--panel_header_height)`, etc.
- **Customizações do projeto:** `src/styles/variables/global.css` (`:root`):
  z-index, `--marquee-height`, e cores auxiliares
  (`--slider-mark-*`, `--finger-*`, `--info-block-color`).
- **Por componente:** CSS Modules (`*.module.css`) ao lado de cada componente.

### 9.2 Onde ficam os estilos
- Entrada global: `src/styles/index.css` (importa `reset.css` + `variables/global.css`).
- Estilo por componente: `*.module.css`.
- Config de tema em runtime: `AppWrapper` usa
  `<ConfigProvider colorScheme={theme} platform='vkcom'>`.

### 9.3 Como alterar a identidade visual
1. **Paleta/tokens:** sobrescrever variáveis VKUI e/ou estender
   `styles/variables/global.css`. O tema (claro/escuro/sistema) vem de
   `ThemeProvider` + `useTheme` (persistido em `localStorage["theme"]`).
2. **Plataforma visual:** `platform='vkcom'` no `AppWrapper` controla o "sabor"
   VKUI — alterá-lo muda densidade/estética global.

### 9.4 Como alterar o logo
- Componente `DynamicLogo` (`components/lib/dynamic-logo`) renderiza
  `assets/device-hub.svg` ou `assets/emulator-hub.svg` conforme `logoType`,
  e aplica classe `darkLogo` no tema escuro.
- Trocar identidade = substituir esses SVGs em `src/assets/` (mantendo os
  imports `?react`) ou ajustar `DynamicLogo`.

### 9.5 Como alterar o favicon
- `ui/index.html`: `<link rel="icon" href="/favicon.ico">`, `/icon.svg`,
  `/apple-touch-icon.png` e `manifest.webmanifest`. Os arquivos ficam em
  `ui/public/`. Também é onde se altera o `<title>` (hoje "DeviceHub").

---

## 10. Dashboard

- **Arquivo que monta o dashboard:** `components/views/devices-page/devices-page.tsx`.
- **Cards:** `components/ui/device-statistics/device-statistics.tsx`, composto por
  4 `StatisticCard` (`components/lib/statistic-card`): Total, Usable, Busy, e um
  card neutro com o nome do usuário + nº de dispositivos "em uso". Os valores vêm
  de getters do `DeviceListStore` (`totalNumberDevices`, `usableDevicesCount`,
  `busyDevicesCount`, `usingDevicesCount`).
- **Como adicionar novos widgets/cards:**
  1. Criar um novo getter derivado no `DeviceListStore` (ou novo store) para a
     métrica.
  2. Adicionar um `<StatisticCard>` em `DeviceStatistics` (ou um novo componente
     de widget) — o container é um `Flex`, então basta incluir mais um item.
  3. Para widgets mais complexos, criar componente em `components/ui/` e
     compô-lo dentro de `DevicesPage` (acima/abaixo da `Group` da tabela).

---

## 11. Device List

- **Componente principal:** `components/ui/device-table/device-table.tsx`
  (usa `@tanstack/react-table`). Estrutura auxiliar: `columns.ts`, `table-body`,
  `helpers` (`fuzzyFilter`), `constants` (`DEFAULT_COLUMN_ORDER`, `ROW_HEIGHT`),
  células em `cells/`.
- **Busca:** `SearchDevice` escreve em `deviceTableState.globalFilter`; a tabela
  aplica `useDebounce(250ms)` + `resolveTableFilterValue` (suporta filtro global
  e por coluna) e seta `globalFilter`/`columnFilters` no react-table.
- **Filtros:** `getFilteredRowModel` + `filterFns.fuzzy` (match-sorter).
- **Ordenação:** `getSortedRowModel`; ordenação inicial por `state` e depois
  `product`; clique no cabeçalho alterna asc/desc/limpar.
- **Visibilidade de colunas:** `deviceTableState.columnVisibility` +
  `TableColumnVisibility`.
- **Paginação:** não há paginação clássica; usa **cabeçalho fixo**
  (`TableWithStickyHeader`) e a lista é renderizada por altura calculada
  (`rows.length * ROW_HEIGHT`). O projeto inclui `@tanstack/react-virtual` para
  virtualização.
- **Atualização em tempo real:** `DeviceListStore` escuta `socket.on('device.change')`,
  acumula updates em `batchedUpdates`, e a cada 250ms (`throttle`) aplica
  `queryClient.setQueryData` na lista — cada linha alterada recebe
  `needUpdate: Date.now()` para re-render seletivo.
- **Estados de UI:** loading (10 linhas skeleton), vazio ("No devices connected"),
  erro ("Something went wrong"), via `ConditionalRender` + `Placeholder`.

---

## 12. Dependências Críticas (NÃO modificar numa refatoração visual)

| Arquivo / pasta | Motivo |
|---|---|
| `src/generated/**` | Gerado por orval a partir do OpenAPI; edições são perdidas na regeneração. |
| `src/api/**` (clients, `interceptors.ts`, `socket.ts`) | Contrato de comunicação/auth com o backend; quebra funcional. |
| `src/services/**` (esp. `core/device-control-service`) | Lógica de comandos e protocolo STF. |
| `src/store/device-screen-store/**` | Streaming de tela (WebSocket, canvas, reconexão). |
| `src/store/device-control-store.ts` + `services/touch-service` + `scaling-service` | Tradução de input → comandos; matemática de coordenadas sensível. |
| `src/config/inversify/**` | Grafo de DI; alterar bindings quebra resolução de dependências. |
| `src/config/queries/**` | Chaves/funções de cache; base do estado de servidor. |
| `src/config/variables.config.ts` | URLs por ambiente. |
| `src/components/app/app-router/**` | Rotas e guarda de autenticação. |
| `src/store/auth-store.ts` + hooks de auth | Autenticação/persistência do JWT. |
| `vite.config.ts`, `tsconfig*`, `orval.config.ts` | Build/tipos/geração. |

> **Regra de ouro para rebranding:** mexer em `components/lib` (visual genérico),
> `components/ui` (composição/estilo), `styles/**`, `assets/**`, `index.html` e
> tokens de tema — **sem** tocar em `services`, `store` de sessão, `api`,
> `config` e `generated`.

---

## 13. Pontos de Extensão

| Necessidade | Melhor ponto de extensão |
|---|---|
| **Novo dashboard** | Nova `view` em `components/views/` + rota em `app-router.tsx` + link no `Header`. |
| **Novos widgets/cards** | `DeviceStatistics` (add `StatisticCard`) ou novo componente em `components/ui/` composto na `DevicesPage`. Derivar métricas em `DeviceListStore`. |
| **Métricas** | Getters computados em stores MobX (padrão dos contadores atuais) + nova query em `query-key-store.ts` se vier do backend. |
| **Gráficos** | Novo componente em `components/ui/`; adicionar lib de charts como dependência; alimentar via store/React Query. |
| **Logs** | Já existe base: `services/logs-tracker-service`, `save-logs-service`, aba `logs-tab` e `logs-table-state`. Estender a aba ou criar uma view global de logs. |
| **Auditoria** | Novo service em `services/` + query dedicada + view/aba; reutilizar `OutputLogArea`/`TableWithStickyHeader`. |
| **Notificações** | Já há `globalToast` + `ErrorToast` (padrão de toast). Criar um `notification-store` MobX e um centro de notificações no `Header`. |
| **Histórico** | Persistir via store (mobx-persist) e/ou query; reaproveitar `settingsService.updateLastUsedDevice` como referência de "recentes". |
| **Configurações** | `SettingsPage` já é orientada a abas (`TabsPanel` + `routeSync`): adicionar item em `tabsContent` + rota em `route-paths.ts`/`app-router.tsx`. |

---

## 14. Roadmap de Refatoração (proposto, por fases)

> Sequência pensada para minimizar risco: começa pelo visual isolado e só depois
> toca em áreas de maior acoplamento funcional. Nenhuma fase exige alterar
> `services`, `api` ou `generated` além do estritamente necessário.

**Fase 1 — Rebranding**
- Trocar logos (`assets/device-hub.svg`, `emulator-hub.svg`), favicon/manifest
  (`public/` + `index.html`), `<title>`.
- Definir paleta e tokens em `styles/variables/global.css` e overrides de VKUI.
- Revisar `ThemeSwitcher`/`platform` do `ConfigProvider`.

**Fase 2 — Novo Dashboard**
- Redesenhar `DevicesPage` + `DeviceStatistics`; padronizar `StatisticCard`.
- Introduzir grid de widgets; preparar slots para gráficos/métricas.

**Fase 3 — Device Cards / Device List**
- Modernizar `DeviceTable` (células, estados vazio/erro/loading) e/ou visão em
  cards; manter filtros/ordenação/tempo real intactos.

**Fase 4 — Sessão Remota**
- Refinar o layout de `ControlPage` (split, top bar, painel de abas) **sem**
  alterar `device-screen-store` nem `touch/scaling services`.

**Fase 5 — Logs**
- Evoluir `logs-tab` e criar visão consolidada de logs reaproveitando
  `logs-tracker-service`/`OutputLogArea`.

**Fase 6 — Configurações**
- Reorganizar `SettingsPage` (abas, agrupamentos, permissões de admin);
  padronizar formulários.

**Fase 7 — Auditoria**
- Adicionar trilha de auditoria (service + query + view), respeitando permissões.

**Fase 8 — Otimização**
- Virtualização efetiva da lista (`@tanstack/react-virtual`), _code splitting_
  das views (`*.async.tsx` já existentes), análise de bundle
  (`bundle-analyzer`), memoização e revisão de re-renders MobX.

---

### Apêndice — Scripts úteis (`ui/package.json`)
- `dev` / `dev:mock` — dev server (real / com MSW).
- `build:prod` / `build:mock` / `build:preview` — builds por ambiente.
- `lint:check` / `code:check` / `stylelint:check` — qualidade.
- `test:unit` (Vitest) — testes.
- `generate-api` (orval) / `generate-code` (plop) — geração.
