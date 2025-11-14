import { useEffect, useState } from "react";

function GoogleLogin() {
  const [authUrl, setAuthUrl] = useState("");

  useEffect(() => {
    fetch("http://localhost:3000/auth/url")
      .then(res => res.json())
      .then(data => setAuthUrl(data.url));
  }, []);

  const handleLogin = () => {
    window.location.href = authUrl; // redirige a Google
  };

  return (
    <div>
      <button onClick={handleLogin}>Login con Google</button>
    </div>
  );
}

export default GoogleLogin;

