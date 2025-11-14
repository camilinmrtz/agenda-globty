import GoogleLogin from "./GoogleLogin.jsx";

function App() {
  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h1>Agenda Globty</h1>
      <p>Login con Google para acceder al calendario</p>
      <GoogleLogin />
    </div>
  );
}

export default App;
