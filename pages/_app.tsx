import '../styles/globals.css';
import '@rainbow-me/rainbowkit/styles.css';
import type { AppProps } from 'next/app';
import {
  RainbowKitProvider,
  getDefaultWallets,
  darkTheme,
  RainbowKitAuthenticationProvider,
  createAuthenticationAdapter,
} from '@rainbow-me/rainbowkit';
import { chain, configureChains, createClient, WagmiConfig } from 'wagmi';
import { alchemyProvider } from 'wagmi/providers/alchemy';
import { publicProvider } from 'wagmi/providers/public';
// import { createTheme, NextUIProvider } from "@nextui-org/react";
// import { nextUITheme } from "../app/utils/theme";
// import "@fontsource/nunito";
import { useEffect, useState } from 'react';
import { SiweMessage } from 'siwe';

const { chains, provider, webSocketProvider } = configureChains(
  [
    chain.mainnet,
    chain.polygon,
    chain.optimism,
    chain.arbitrum,
    ...(process.env.NEXT_PUBLIC_ENABLE_TESTNETS === 'true'
      ? [chain.goerli, chain.kovan, chain.rinkeby, chain.ropsten]
      : []),
  ],
  [
    alchemyProvider({
      // This is Alchemy's default API key.
      // You can get your own at https://dashboard.alchemyapi.io
      apiKey: '_gg7wSSi0KMBsdKnGVfHDueq6xMB9EkC',
    }),
    publicProvider(),
  ]
);

const { connectors } = getDefaultWallets({
  appName: 'RainbowKit App',
  chains,
});

const wagmiClient = createClient({
  autoConnect: true,
  connectors,
  provider,
  webSocketProvider,
});

// const darkNextTheme = createTheme({
//   type: "dark",
// });

function MyApp({ Component, pageProps }: AppProps) {
  const [authenticationStatus, setAuthenticationStatus] = useState<
    'loading' | 'authenticated' | 'unauthenticated'
  >('loading');

  const authenticationAdapter = createAuthenticationAdapter({
    getNonce: async () => {
      const response = await fetch('/api/auth/nonce');
      const res = await response.text();
      return res;
    },
    createMessage: ({ nonce, address, chainId }) => {
      return new SiweMessage({
        domain: window.location.host,
        address,
        statement: 'Sign in with Ethereum to the app.',
        uri: window.location.origin,
        version: '1',
        chainId,
        nonce,
      });
    },
    getMessageBody: ({ message }) => {
      return message.prepareMessage();
    },
    verify: async ({ message, signature }) => {
      console.log({ signature });
      const verifyRes = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authSig: {
            message,
            signature,
            signedMessage: message.prepareMessage(),
          },
        }),
      });
      console.log({ verifyRes });
      setAuthenticationStatus(
        verifyRes.ok ? 'authenticated' : 'unauthenticated'
      );
      return Boolean(verifyRes.ok);
    },
    signOut: async () => {
      await fetch('/api/auth/logout');
      setAuthenticationStatus('unauthenticated');
    },
  });

  useEffect(() => {
    const fetchAuthStatus = async () => {
      const res = await fetch('api/auth/me');
      const data = await res.json();
      console.log({ data });
      if (!data?.address) {
        setAuthenticationStatus('unauthenticated');
      } else {
        setAuthenticationStatus('authenticated');
      }
    };
    fetchAuthStatus();
  }, []);

  return (
    <WagmiConfig client={wagmiClient}>
      <RainbowKitAuthenticationProvider
        adapter={authenticationAdapter}
        status={authenticationStatus}
      >
        <RainbowKitProvider
          chains={chains}
          theme={darkTheme({
            borderRadius: 'large',
            fontStack: 'system',
            overlayBlur: 'large',
            ...darkTheme.accentColors.purple,
          })}
          modalSize="compact"
        >
          {/* <NextUIProvider theme={nextUITheme}> */}
          <Component {...pageProps} />
          {/* </NextUIProvider> */}
        </RainbowKitProvider>
      </RainbowKitAuthenticationProvider>
    </WagmiConfig>
  );
}

export default MyApp;
