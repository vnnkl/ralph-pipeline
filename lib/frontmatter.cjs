/**
 * Frontmatter -- YAML frontmatter parsing and reconstruction
 *
 * Provides: extractFrontmatter(), reconstructFrontmatter()
 *
 * Handles a YAML subset: strings, numbers, booleans, null,
 * inline arrays [a, b], block arrays (- item), and nested objects.
 * No npm YAML parser -- hand-rolled from GSD's proven pattern.
 */

// -- Value coercion -----------------------------------------------------------

/**
 * Coerce a raw YAML string value to its JS type.
 */
function coerceValue(raw) {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw === 'null' || raw === '~') return null;

  // Strip surrounding quotes
  const unquoted = raw.replace(/^["']|["']$/g, '');

  // Numeric check (integers and floats, but not strings that happen to start with digits)
  if (/^-?\d+(\.\d+)?$/.test(raw)) {
    return Number(raw);
  }

  return unquoted;
}

// -- Extraction ---------------------------------------------------------------

/**
 * Extract YAML frontmatter from markdown content.
 *
 * Returns { frontmatter: {}, body: string, hasFrontmatter: boolean }.
 * Handles: key: value, inline arrays [a, b], block arrays (- item),
 * nested objects (indented keys), and multi-level nesting.
 */
function extractFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]+?)\n---/);
  if (!match) {
    return { frontmatter: {}, body: content, hasFrontmatter: false };
  }

  const yaml = match[1];
  const body = content.slice(match[0].length).replace(/^\n/, '');
  const frontmatter = {};
  const lines = yaml.split('\n');

  // Stack tracks nested context: [{obj, indent}]
  const stack = [{ obj: frontmatter, indent: -1 }];

  for (const line of lines) {
    if (line.trim() === '') continue;

    const indentMatch = line.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1].length : 0;

    // Pop stack to appropriate nesting level
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }

    const current = stack[stack.length - 1];

    // Array item: "  - value"
    const arrayItemMatch = line.match(/^(\s*)-\s+(.*)/);
    if (arrayItemMatch) {
      const itemValue = arrayItemMatch[2].replace(/^["']|["']$/g, '');

      if (typeof current.obj === 'object' && !Array.isArray(current.obj) && Object.keys(current.obj).length === 0) {
        // Convert empty object placeholder to array
        const parent = stack.length > 1 ? stack[stack.length - 2] : null;
        if (parent) {
          for (const k of Object.keys(parent.obj)) {
            if (parent.obj[k] === current.obj) {
              parent.obj[k] = [coerceValue(itemValue)];
              current.obj = parent.obj[k];
              break;
            }
          }
        }
      } else if (Array.isArray(current.obj)) {
        current.obj.push(coerceValue(itemValue));
      }
      continue;
    }

    // Key: value pattern
    const keyMatch = line.match(/^(\s*)([a-zA-Z0-9_-]+):\s*(.*)/);
    if (keyMatch) {
      const key = keyMatch[2];
      const value = keyMatch[3].trim();

      if (value === '' || value === '[') {
        // Nested object or block array -- determined by subsequent lines
        current.obj[key] = value === '[' ? [] : {};
        stack.push({ obj: current.obj[key], indent });
      } else if (value.startsWith('[') && value.endsWith(']')) {
        // Inline array: [a, b, c]
        const inner = value.slice(1, -1);
        if (inner.trim() === '') {
          current.obj[key] = [];
        } else {
          current.obj[key] = inner
            .split(',')
            .map(s => coerceValue(s.trim()))
            .filter(v => v !== '');
        }
      } else {
        // Simple value
        current.obj[key] = coerceValue(value);
      }
    }
  }

  return { frontmatter, body, hasFrontmatter: true };
}

// -- Reconstruction -----------------------------------------------------------

/**
 * Serialize a value for YAML output.
 * Quotes strings containing colons, hashes, or starting with brackets.
 */
function serializeValue(val) {
  if (val === null || val === undefined) return 'null';
  if (typeof val === 'boolean') return String(val);
  if (typeof val === 'number') return String(val);

  const sv = String(val);
  if (sv.includes(':') || sv.includes('#') || sv.startsWith('[') || sv.startsWith('{')) {
    return `"${sv}"`;
  }
  return sv;
}

/**
 * Serialize an array for YAML.
 * Short arrays of simple strings use inline format [a, b].
 * Longer/complex arrays use block format with "- item".
 */
function serializeArray(arr, indentStr) {
  const lines = [];
  if (arr.length === 0) {
    return '[]';
  }

  const allSimple = arr.every(v => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean');
  if (allSimple && arr.length <= 3 && arr.join(', ').length < 60) {
    return '[' + arr.join(', ') + ']';
  }

  // Block format
  for (const item of arr) {
    const sv = typeof item === 'string' && (item.includes(':') || item.includes('#'))
      ? `"${item}"`
      : String(item);
    lines.push(`${indentStr}  - ${sv}`);
  }
  return '\n' + lines.join('\n');
}

/**
 * Reconstruct full file content from a frontmatter object and body string.
 * Serializes the object back to YAML subset format with --- delimiters.
 */
function reconstructFrontmatter(frontmatter, body) {
  const lines = [];

  for (const [key, value] of Object.entries(frontmatter)) {
    if (value === null || value === undefined) {
      lines.push(`${key}: null`);
      continue;
    }

    if (Array.isArray(value)) {
      const serialized = serializeArray(value, '');
      if (serialized.startsWith('\n')) {
        lines.push(`${key}:${serialized}`);
      } else {
        lines.push(`${key}: ${serialized}`);
      }
    } else if (typeof value === 'object') {
      lines.push(`${key}:`);
      for (const [subkey, subval] of Object.entries(value)) {
        if (subval === null || subval === undefined) {
          lines.push(`  ${subkey}: null`);
          continue;
        }

        if (Array.isArray(subval)) {
          const serialized = serializeArray(subval, '  ');
          if (serialized.startsWith('\n')) {
            lines.push(`  ${subkey}:${serialized}`);
          } else {
            lines.push(`  ${subkey}: ${serialized}`);
          }
        } else if (typeof subval === 'object') {
          lines.push(`  ${subkey}:`);
          for (const [subsubkey, subsubval] of Object.entries(subval)) {
            if (subsubval === null || subsubval === undefined) {
              lines.push(`    ${subsubkey}: null`);
            } else if (Array.isArray(subsubval)) {
              const serialized = serializeArray(subsubval, '    ');
              if (serialized.startsWith('\n')) {
                lines.push(`    ${subsubkey}:${serialized}`);
              } else {
                lines.push(`    ${subsubkey}: ${serialized}`);
              }
            } else {
              lines.push(`    ${subsubkey}: ${serializeValue(subsubval)}`);
            }
          }
        } else {
          lines.push(`  ${subkey}: ${serializeValue(subval)}`);
        }
      }
    } else {
      lines.push(`${key}: ${serializeValue(value)}`);
    }
  }

  const yamlBlock = '---\n' + lines.join('\n') + '\n---';
  if (body !== undefined && body !== null) {
    return yamlBlock + '\n' + body;
  }
  return yamlBlock + '\n';
}

// -- Splice -------------------------------------------------------------------

/**
 * Extract frontmatter, merge updates immutably, reconstruct.
 * Returns full file content string.
 */
function spliceFrontmatter(content, updates) {
  const { frontmatter, body } = extractFrontmatter(content);
  const merged = { ...frontmatter, ...updates };
  return reconstructFrontmatter(merged, body);
}

module.exports = {
  extractFrontmatter,
  reconstructFrontmatter,
};
