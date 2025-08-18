const $ = (id) => document.getElementById(id)

const username = $('username')
const password = $('password')
const antenna  = $('antenna')
const btnLogin = $('btnLogin')
const statusText = $('statusText')
const errorText  = $('errorText')
// const btnHelp = $('btnHelp')

let antennas = []
let isLogged = false

async function loadAntennas() {
  antennas = await window.api.getAntennas()
  antenna.innerHTML = ''
  antennas.forEach(a => {
    const opt = document.createElement('option')
    opt.value = a.id
    opt.textContent = a.name
    antenna.appendChild(opt)
  })
}

function setStatus(msg, isError = false) {
  if (isError) {
    errorText.style.display = ''
    errorText.textContent = msg
  } else {
    errorText.style.display = 'none'
    statusText.textContent = msg
  }
}

async function handleLogin() {
  setStatus('Conectando...')
  const creds = { username: username.value.trim(), password: password.value }
  if (!creds.username || !creds.password) {
    setStatus('Usuario y contraseña son obligatorios', true)
    return
  }
  const res = await window.api.login(creds)
  if (!res.ok) {
    setStatus(res.message || 'Credenciales inválidas', true)
    return
  }
  isLogged = true
  setStatus('Autenticado')

  // Buscar URL de antena seleccionada
  const chosen = antennas.find(a => a.id === antenna.value)
  if (!chosen) {
    setStatus('Selecciona una antena válida', true)
    return
  }

  const nav = await window.api.navigateTo(chosen.url)
  if (!nav.ok) {
    setStatus(nav.message || 'No se pudo conectar al destino', true)
    return
  }
  setStatus(`Conectado a: ${chosen.name}`)
}

btnLogin.addEventListener('click', handleLogin)
password.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleLogin() })

// btnHelp?.addEventListener('click', () => {
//   window.api.openExternal('https://tu-dominio/ayuda')
// })

loadAntennas().catch(err => setStatus(String(err), true))
