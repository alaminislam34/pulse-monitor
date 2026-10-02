package pulse

import (
	"encoding/json"
	"strings"
)

var defaultSensitiveKeys = map[string]bool{
	"authorization":       true,
	"cookie":              true,
	"set-cookie":          true,
	"x-api-key":           true,
	"api-key":             true,
	"password":            true,
	"pass":                true,
	"token":               true,
	"access_token":        true,
	"refresh_token":       true,
	"secret":              true,
	"client_secret":       true,
	"private_key":         true,
	"credit_card":         true,
	"card_number":         true,
	"cvv":                 true,
	"ssn":                 true,
}

// SanitizeHeaders redacts values for known sensitive HTTP headers.
func SanitizeHeaders(headers map[string]string) map[string]string {
	clean := make(map[string]string, len(headers))
	for k, v := range headers {
		lower := strings.ToLower(k)
		if defaultSensitiveKeys[lower] || strings.Contains(lower, "token") || strings.Contains(lower, "secret") {
			clean[k] = "[REDACTED]"
		} else {
			clean[k] = v
		}
	}
	return clean
}

// SanitizePayload recursively scrubs sensitive keys from JSON maps or raw strings.
func SanitizePayload(payload string) string {
	if strings.TrimSpace(payload) == "" {
		return payload
	}

	var data interface{}
	if err := json.Unmarshal([]byte(payload), &data); err != nil {
		// Not JSON, return original
		return payload
	}

	scrubbed := scrubInterface(data)
	bytes, err := json.Marshal(scrubbed)
	if err != nil {
		return payload
	}
	return string(bytes)
}

func scrubInterface(v interface{}) interface{} {
	switch val := v.(type) {
	case map[string]interface{}:
		cleanMap := make(map[string]interface{}, len(val))
		for k, item := range val {
			lower := strings.ToLower(k)
			if defaultSensitiveKeys[lower] || strings.Contains(lower, "password") || strings.Contains(lower, "secret") || strings.Contains(lower, "token") {
				cleanMap[k] = "[REDACTED]"
			} else {
				cleanMap[k] = scrubInterface(item)
			}
		}
		return cleanMap
	case []interface{}:
		cleanSlice := make([]interface{}, len(val))
		for i, item := range val {
			cleanSlice[i] = scrubInterface(item)
		}
		return cleanSlice
	default:
		return val
	}
}
