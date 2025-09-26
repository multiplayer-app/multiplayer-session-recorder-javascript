# Configuration Setup

This example app requires a Session Recorder API key to function properly.

## Setup Instructions

1. Copy the example configuration file:

   ```bash
   cp config.example.js config.js
   ```

2. Edit `config.js` and replace `your_api_key_here` with your actual Session Recorder API key.

3. The `config.js` file is already ignored by git and will not be committed to version control.

## Security Notes

- Never commit your actual API key to version control
- The `config.js` file is automatically ignored by `.gitignore`
- Use the `config.example.js` file as a template for other developers
