// Initialize Ajv validator after DOM loads
let ajv;

// Wait for Ajv to load from CDN
window.addEventListener('load', () => {
  // The ajv2020.bundle.js exposes window.ajv2020
  if (window.ajv2020 && window.ajv2020.default) {
    ajv = new window.ajv2020.default({
        validateSchema: false
    });
    console.log('Ajv loaded successfully');

    // Load initial data if provided (from server for /:id route)
    if (window.INITIAL_DATA) {
      // Convert objects to formatted JSON strings for display
      schemaEditor.value = JSON.stringify(window.INITIAL_DATA.schema, null, 2);
      jsonEditor.value = JSON.stringify(window.INITIAL_DATA.json, null, 2);
      // Update line numbers
      updateLineNumbers(schemaEditor, schemaLineNumbers);
      updateLineNumbers(jsonEditor, jsonLineNumbers);
      // Trigger validation on load
      setTimeout(validateJson, 100);
    }
  } else {
    console.error('Ajv failed to load from CDN. Available:', Object.keys(window).filter(k => k.toLowerCase().includes('ajv')));
  }
});

// Get DOM elements
const schemaEditor = document.getElementById('schemaEditor');
const jsonEditor = document.getElementById('jsonEditor');
const resultsDiv = document.getElementById('results');
const saveBtn = document.getElementById('saveBtn');
const shareLink = document.getElementById('shareLink');
const shareLinkInput = document.getElementById('shareLinkInput');
const copyBtn = document.getElementById('copyBtn');
const copySchemaBtn = document.getElementById('copySchemaBtn');
const copyJsonBtn = document.getElementById('copyJsonBtn');
const prettifySchemaBtn = document.getElementById('prettifySchemaBtn');
const prettifyJsonBtn = document.getElementById('prettifyJsonBtn');
const exampleBtn = document.getElementById('exampleBtn');
const schemaLineNumbers = document.getElementById('schemaLineNumbers');
const jsonLineNumbers = document.getElementById('jsonLineNumbers');

// Update line numbers for a textarea
function updateLineNumbers(textarea, lineNumbersDiv) {
  const lines = textarea.value.split('\n').length;
  const lineNumbersArray = [];
  for (let i = 1; i <= lines; i++) {
    lineNumbersArray.push(i);
  }
  lineNumbersDiv.textContent = lineNumbersArray.join('\n');

  // Sync scroll position
  lineNumbersDiv.scrollTop = textarea.scrollTop;
}

// Sync scroll between textarea and line numbers
function syncScroll(textarea, lineNumbersDiv) {
  lineNumbersDiv.scrollTop = textarea.scrollTop;
}

// Initialize line numbers
updateLineNumbers(schemaEditor, schemaLineNumbers);
updateLineNumbers(jsonEditor, jsonLineNumbers);

// Update line numbers on input
schemaEditor.addEventListener('input', () => updateLineNumbers(schemaEditor, schemaLineNumbers));
jsonEditor.addEventListener('input', () => updateLineNumbers(jsonEditor, jsonLineNumbers));

// Sync scroll
schemaEditor.addEventListener('scroll', () => syncScroll(schemaEditor, schemaLineNumbers));
jsonEditor.addEventListener('scroll', () => syncScroll(jsonEditor, jsonLineNumbers));

// Debounce function to avoid excessive validation
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Validate JSON against schema
function validateJson() {
  console.log('Validating JSON...');

  if (!ajv) {
    resultsDiv.innerHTML = '<p class="error">Validator not loaded yet. Please wait...</p>';
    return;
  }

  const schemaText = schemaEditor.value.trim();
  const jsonText = jsonEditor.value.trim();

  // Clear previous results if either is empty
  if (!schemaText || !jsonText) {
    resultsDiv.innerHTML = '<p class="info">Enter both JSON Schema and JSON Input to see validation results.</p>';
    return;
  }

  let schema, data;

  // Parse schema
  try {
    schema = JSON.parse(schemaText);
  } catch (e) {
    resultsDiv.innerHTML = `<div class="error">Invalid JSON Schema: ${e.message}</div>`;
    return;
  }

  // Parse JSON input
  try {
    data = JSON.parse(jsonText);
  } catch (e) {
    resultsDiv.innerHTML = `<div class="error">Invalid JSON Input: ${e.message}</div>`;
    return;
  }

  // Perform validation
  try {
    const validate = ajv.compile(schema);
    const valid = validate(data);

    if (valid) {
      resultsDiv.innerHTML = '<div class="success">✓ JSON is valid according to the schema!</div>';
    } else {
      const errors = validate.errors || [];
      let errorHtml = '<div class="error">✗ Validation failed</div>';
      errorHtml += '<div class="error-list">';

      errors.forEach(error => {
        const path = error.instancePath || '/';
        const message = error.message || 'Unknown error';
        const params = error.params ? JSON.stringify(error.params) : '';

        errorHtml += `
          <div class="error-item">
            <div class="error-path">Path: ${path}</div>
            <div class="error-message">${message}</div>
            ${params ? `<div class="error-message" style="font-size: 12px; color: #888;">Details: ${params}</div>` : ''}
          </div>
        `;
      });

      errorHtml += '</div>';
      resultsDiv.innerHTML = errorHtml;
    }
  } catch (e) {
    resultsDiv.innerHTML = `<div class="error">Validation error: ${e.message}</div>`;
  }
}

// Add event listeners for real-time validation
const debouncedValidation = debounce(validateJson, 500);
schemaEditor.addEventListener('input', debouncedValidation);
jsonEditor.addEventListener('input', debouncedValidation);

// Save and share functionality
saveBtn.addEventListener('click', async () => {
  const schemaText = schemaEditor.value.trim();
  const jsonText = jsonEditor.value.trim();

  if (!schemaText || !jsonText) {
    alert('Please enter both JSON Schema and JSON Input before saving.');
    return;
  }

  // Validate JSON format and parse before saving
  let schemaObj, jsonObj;
  try {
    schemaObj = JSON.parse(schemaText);
    jsonObj = JSON.parse(jsonText);
  } catch (e) {
    alert('Please ensure both inputs are valid JSON before saving.');
    return;
  }

  try {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    const response = await fetch('/api/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        schema: schemaObj,
        json: jsonObj
      })
    });

    if (!response.ok) {
      throw new Error('Failed to save validation');
    }

    const { id } = await response.json();
    const url = `${window.location.origin}/${id}`;

    shareLinkInput.value = url;
    shareLink.style.display = 'flex';
    saveBtn.textContent = 'Saved!';

    setTimeout(() => {
      saveBtn.textContent = 'Save & Share';
      saveBtn.disabled = false;
    }, 2000);
  } catch (error) {
    alert('Error saving validation: ' + error.message);
    saveBtn.textContent = 'Save & Share';
    saveBtn.disabled = false;
  }
});

// Copy link to clipboard
copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(shareLinkInput.value);
    copyBtn.textContent = 'Copied!';
    setTimeout(() => {
      copyBtn.textContent = 'Copy';
    }, 2000);
  } catch (error) {
    // Fallback for older browsers
    shareLinkInput.select();
    document.execCommand('copy');
    copyBtn.textContent = 'Copied!';
    setTimeout(() => {
      copyBtn.textContent = 'Copy';
    }, 2000);
  }
});

// Prettify JSON functionality
function prettifyJson(textarea) {
  const text = textarea.value.trim();
  if (!text) {
    return;
  }

  try {
    const parsed = JSON.parse(text);
    textarea.value = JSON.stringify(parsed, null, 2);

    // Update line numbers
    if (textarea === schemaEditor) {
      updateLineNumbers(schemaEditor, schemaLineNumbers);
    } else if (textarea === jsonEditor) {
      updateLineNumbers(jsonEditor, jsonLineNumbers);
    }

    // Trigger validation after prettifying
    debouncedValidation();
  } catch (e) {
    alert('Cannot prettify: Invalid JSON');
  }
}

prettifySchemaBtn.addEventListener('click', () => {
  prettifyJson(schemaEditor);
});

prettifyJsonBtn.addEventListener('click', () => {
  prettifyJson(jsonEditor);
});

// Copy content to clipboard
async function copyToClipboard(text, button) {
  try {
    await navigator.clipboard.writeText(text);
    const originalText = button.textContent;
    button.textContent = 'Copied!';
    setTimeout(() => {
      button.textContent = originalText;
    }, 2000);
  } catch (error) {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    const originalText = button.textContent;
    button.textContent = 'Copied!';
    setTimeout(() => {
      button.textContent = originalText;
    }, 2000);
  }
}

copySchemaBtn.addEventListener('click', () => {
  copyToClipboard(schemaEditor.value, copySchemaBtn);
});

copyJsonBtn.addEventListener('click', () => {
  copyToClipboard(jsonEditor.value, copyJsonBtn);
});

// Load example data
exampleBtn.addEventListener('click', () => {
  const exampleSchema = {
      "$schema": "http://json-schema.org/2020-12/schema#",
      "type": "object",
      "properties": {
          "name": {
              "type": "string",
              "minLength": 1
          },
          "age": {
              "type": "number",
              "minimum": 0,
              "maximum": 120
          },
          "email": {
              "type": "string"
          },
          "address": {
              "type": "object",
              "properties": {
                  "street": {
                      "type": "string"
                  },
                  "city": {
                      "type": "string"
                  },
                  "zipCode": {
                      "type": "string",
                      "pattern": "^[0-9]{5}$"
                  }
              },
              "required": [
                  "street",
                  "city"
              ]
          }
      },
      "required": [
          "name",
          "email"
      ]
  };

  const exampleJson = {
    "name": "John Doe",
    "age": 30,
    "email": "john.doe@example.com",
    "address": {
      "street": "123 Main St",
      "city": "Springfield",
      "zipCode": "12345"
    }
  };

  schemaEditor.value = JSON.stringify(exampleSchema, null, 2);
  jsonEditor.value = JSON.stringify(exampleJson, null, 2);

  // Update line numbers
  updateLineNumbers(schemaEditor, schemaLineNumbers);
  updateLineNumbers(jsonEditor, jsonLineNumbers);

  // Trigger validation
  validateJson();
});
