import { useEffect } from "react";

function GoogleLogin() {
  useEffect(() => 
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
    script.onload = () => {
  
      window.google.accounts.id.initialize({
        client_id: "876736803998-c86thjpgvlijqafimud2pskgurd7njfu.apps.googleusercontent.com",
        callback: handleCredentialResponse, 
      });

      
      window.google.accounts.id.renderButton(
        document.getElementById("googleButton"),
        { theme: "outline", size: "large" } 
      );

    };
  }, []);


  const handleCredentialResponse = (response) => {
    console.log("Token JWT recibido:", response.credential);
   
  };

  return <div id="googleButton"></div>;
}

export default GoogleLogin;
