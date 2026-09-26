export const THEME_KEY = "up.theme";

// Runs before paint (inlined in <head>) so a stored dark theme never flashes light.
export const themeBootScript = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t)}catch(e){}})()`;
