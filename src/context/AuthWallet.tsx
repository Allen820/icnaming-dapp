import React, { useContext, useState, useEffect } from "react";
import { AuthClient } from "@dfinity/auth-client";
import { actorFactory } from 'utils/canisters/actorFactory';
import { IC_HOST } from "utils/config";
import { principalToAccountID } from "../utils/helper";
import { Principal } from "@dfinity/principal";
import { whietLists } from "utils/canisters/plugWhiteListConfig";
import { StoicIdentity } from "utils/ic-stoic-identity/index";
import { Toast } from "@douyinfe/semi-ui";
declare const window: any;
/* const u = navigator.userAgent;
const isAndroid = u.indexOf('Android') > -1 || u.indexOf('Adr') > -1;
const isiOS = !!u.match(/\(i[^;]+;( U;)? CPU.+Mac OS X/); */

export interface AuthWalletContextInterface {
  isAuthWalletConnected: boolean;
  walletAddress: string;
  principal?: Principal | undefined;
  accountId: string;
  walletType: string;
  connectPlugWallet();
  connectII();
  connectStoic();
  quitWallet();
}

function useProvideAuthWallet() {
  const [isAuthWalletConnected, setAuthWalletConnected] = useState<boolean>(false)
  const [walletAddress, setWalletAddress] = useState<string>('')
  const [walletAccountId, setWalletAccountId] = useState<string>('')
  const [principal, setPrincipal] = useState<Principal | undefined>(undefined)
  const [walletType, setWalletType] = useState<string>('')
  const whitelist = whietLists();
  const setauthWalletState = (accountId, principalId, connected, walletType) => {
    setAuthWalletConnected(connected)
    setWalletAccountId(accountId)
    setPrincipal(principalId)
    setWalletAddress(principalId.toText())
    setWalletType(walletType)
    sessionStorage.setItem("connectStatus", 'connected');
    sessionStorage.setItem('walletType', walletType)
  }


  const connectStoic = async () => {
    return new Promise(async (resolve, reject) => {
      StoicIdentity.load().then(async (identity) => {
        if (identity === false) {
          //No existing connection, lets make one!
          identity = await StoicIdentity.connect();
        }
        await actorFactory.authenticateWithIdentity(identity);
        const principalId = identity?.getPrincipal();
        const accountId = principalToAccountID(principalId)
        setauthWalletState(accountId, principalId, true, 'stioc')
        resolve({ connected: true });
        // StoicIdentity.disconnect();
      }).catch(err => {
        Toast.error(err)
        console.error(`stonic connect error${err}`);
        reject(err)
      })
    })
  }

  const connectPlugWallet = async () => {
    return new Promise(async (resolve, reject) => {
      if (typeof (window as any).ic === 'undefined') {
        window.open('https://plugwallet.ooo/')
        setAuthWalletConnected(false);
        return false
      } else {
        try {
          const connected = await window.ic.plug.isConnected();
          if (connected && !window.ic.plug.agent) {
            await window.ic?.plug?.createAgent({ whitelist, host: IC_HOST });
            const principalId = await window.ic?.plug?.agent.getPrincipal();
            actorFactory.authenticateWithAgent(await window.ic?.plug?.agent)
            const accountId = principalToAccountID(principalId)
            setauthWalletState(accountId, principalId, true, 'plug')
            setAuthWalletConnected(true);
          } else {
            const requestConnect = await window.ic?.plug?.requestConnect({
              whitelist,
              host: IC_HOST
            });
            if (requestConnect) {
              const principalId = await window.ic?.plug?.agent.getPrincipal();
              console.log('principalId', principalId)
              actorFactory.authenticateWithAgent(await window.ic?.plug?.agent);
              const accountId = principalToAccountID(principalId)
              setauthWalletState(accountId, principalId, true, 'plug')
              resolve({ connected: true });
            } else {
              Toast.error('Fail Connect')
              resolve({ connected: false });
            }
          }

          
        } catch (error) {
          Toast.error('Authorization Rejected')
          reject(error)
        }
      }
    });
  }

  const connectII = async () => {
    return new Promise(async (resolve, reject) => {
      try {
        const authClient = await AuthClient.create();
        if (await authClient.isAuthenticated()) {
          const identity = await authClient.getIdentity();
          actorFactory.authenticateWithIdentity(identity);
          const accountId = principalToAccountID(identity.getPrincipal())
          setauthWalletState(accountId, identity.getPrincipal(), true, 'nns')
        }else{
          await authClient.login({
            onSuccess: async () => {
              const identity = await authClient.getIdentity();
              actorFactory.authenticateWithIdentity(identity);
              const accountId = principalToAccountID(identity.getPrincipal())
              setauthWalletState(accountId, identity.getPrincipal(), true, 'nns')
              resolve({ connected: true });
            },
            onError: async () => {
              Toast.error('Fail Connect');
              resolve({ connected: false });
            }
          })
        }
      } catch (error) {
        Toast.error('Authorization Rejected')
        reject(error)
      }
    });
  }

  useEffect(() => {
    (async () => {
      if (sessionStorage.getItem('connectStatus') === 'connected') {
        setAuthWalletConnected(true)
        let walletTypeStorage = sessionStorage.getItem('walletType')
        if (walletTypeStorage) {
          switch (walletTypeStorage) {
            case "plug":
              connectPlugWallet()
              break;
            case "nns":
              connectII()
              break;
            case "stioc":
              connectStoic()
              break;
          }
        }
      }
    })();
  }, [])// eslint-disable-line react-hooks/exhaustive-deps


  const quitWallet = async () => {
    setAuthWalletConnected(false)
    setWalletAccountId('')
    setPrincipal(undefined)
    setWalletAddress('')
    sessionStorage.removeItem("connectStatus");
    sessionStorage.removeItem("walletType");
    localStorage.removeItem('ic-identity');//Disconnect NNS Wallet
    localStorage.removeItem('ic-delegation');//Disconnect NNS Wallet

    if (localStorage.getItem("_scApp")) {
      localStorage.removeItem("_scApp"); //Disconnect Stoic Wallet
      StoicIdentity.disconnect();
    } else if (window.ic.plug.agent) {
      window.ic?.plug?.disconnect()
    } else {
      const authClient = await AuthClient.create();
      authClient.logout()
    }
  }


  return {
    isAuthWalletConnected: isAuthWalletConnected,
    walletAddress: walletAddress,
    principal: principal,
    accountId: walletAccountId,
    walletType: walletType,
    connectPlugWallet,
    connectII,
    connectStoic,
    quitWallet,
  }
}


export const ConnectContext = React.createContext<AuthWalletContextInterface>(null!);
export function ProvideConnectContext({ children }) {
  const authWallet = useProvideAuthWallet();
  return <ConnectContext.Provider value={authWallet}>{children}</ConnectContext.Provider>;
}

export const useAuthWallet = () => {
  return useContext(ConnectContext);
};