import type { Agent } from '@aries-framework/core'
// eslint-disable-next-line import/no-unresolved
import type { TypedUseSelectorHook } from 'react-redux'

// eslint-disable-next-line import/no-unresolved
import { combineReducers, configureStore } from '@reduxjs/toolkit'
// eslint-disable-next-line import/no-unresolved
import { useDispatch, useSelector } from 'react-redux'

import { credentialsSlice, proofsSlice, connectionsSlice, agentSlice } from './slices'

const rootReducer = combineReducers({
  agent: agentSlice.reducer,
  connections: connectionsSlice.reducer,
  credentials: credentialsSlice.reducer,
  proofs: proofsSlice.reducer,
})

type RootState = ReturnType<typeof rootReducer>
const useAppSelector: TypedUseSelectorHook<RootState> = useSelector

const initializeStore = (agent: Agent) => {
  const store = configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        thunk: {
          extraArgument: {
            agent,
          },
        },
      }),
  })

  type AppDispatch = typeof store.dispatch
  const useAppDispatch = () => useDispatch<AppDispatch>()

  return {
    store,
    useAppDispatch,
  }
}

export { initializeStore, useAppSelector }

export type { RootState }
