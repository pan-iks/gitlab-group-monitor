import { boot } from 'quasar/wrappers'
import axios from 'axios'
import token from '../config/gitlab'

// Be careful when using SSR for cross-request state pollution
// due to creating a Singleton instance here;
// If any client changes this (global) instance, it might be a
// good idea to move this instance creation inside of the
// "export default () => {}" function below (which runs individually
// for each client)
const api = axios.create({ baseURL: 'https://gitlab.com/api/v4/' })

api.interceptors.request.use(async (config) => {
  if (token) {
    // Zde můžete přidat vlastní zpracování hlaviček
    config.headers['PRIVATE-TOKEN'] = token.token
  }

  return config
})

export default boot(({ app }) => {
  // for use inside Vue files (Options API) through this.$axios and this.$api

  app.config.globalProperties.$axios = axios
  // ^ ^ ^ this will allow you to use this.$axios (for Vue Options API form)
  //       so you won't necessarily have to import axios in each vue file

  app.config.globalProperties.$api = api
  // ^ ^ ^ this will allow you to use this.$api (for Vue Options API form)
  //       so you can easily perform requests against your app's API
})

export { api }
