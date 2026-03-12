/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,jsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                vault: {
                    bg: '#0F0F1A',
                    surface: '#16213E',
                    card: '#1E2A47',
                    blue: '#175DDC',
                    'blue-hover': '#1E6FFF',
                    teal: '#00D2FF',
                    green: '#00C853',
                    amber: '#FFB300',
                    red: '#FF1744',
                    text: '#E8EAED',
                    muted: '#9AA0A6',
                    border: 'rgba(255,255,255,0.08)',
                },
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
            },
        },
    },
    plugins: [],
}
