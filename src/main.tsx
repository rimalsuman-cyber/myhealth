import React from 'react';
import {createRoot} from 'react-dom/client';
import {App} from './App';
createRoot(document.getElementById('root')!).render(<App/>);
if ('serviceWorker' in navigator && (import.meta as unknown as {env:{PROD:boolean}}).env.PROD) {
 window.addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js').catch(()=>{});});
}
