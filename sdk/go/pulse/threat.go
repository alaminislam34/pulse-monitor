package pulse

import (
	"fmt"
	"regexp"
	"strings"
)

// ThreatEvent represents a detected security threat.
type ThreatEvent struct {
	ID        string `json:"id"`
	Type      string `json:"type"`      // SQL_INJECTION, XSS, PATH_TRAVERSAL, SENSITIVE_FILE
	Severity  string `json:"severity"`  // LOW, MEDIUM, HIGH, CRITICAL
	Details   string `json:"details"`
	Source    string `json:"source"`    // query, body, path
	Timestamp int64  `json:"timestamp"`
}

// ThreatDetector scans request strings for attack patterns.
type ThreatDetector struct {
	sqliPatterns      []*regexp.Regexp
	xssPatterns       []*regexp.Regexp
	pathTravPatterns  []*regexp.Regexp
	sensitivePatterns []*regexp.Regexp
}

// NewThreatDetector creates a new ThreatDetector with compiled regular expressions.
func NewThreatDetector() *ThreatDetector {
	return &ThreatDetector{
		sqliPatterns: []*regexp.Regexp{
			regexp.MustCompile(`(?i)(union\s+all\s+select|union\s+select)`),
			regexp.MustCompile(`(?i)(exec(\s|\+)+(s|x)p\w+)`),
			regexp.MustCompile(`(?i)('\s*or\s*'1'\s*=\s*'1|1\s*=\s*1\s*--|'\s*or\s*1\s*=\s*1)`),
			regexp.MustCompile(`(?i)(benchmark\s*\(|sleep\s*\(\s*\d+\s*\))`),
			regexp.MustCompile(`(?i)(select\s+.*\s+from\s+information_schema)`),
		},
		xssPatterns: []*regexp.Regexp{
			regexp.MustCompile(`(?i)<script\b[^>]*>(.*?)</script>`),
			regexp.MustCompile(`(?i)javascript:[^\n]*`),
			regexp.MustCompile(`(?i)onerror\s*=\s*['"]?[^'"]*['"]?`),
			regexp.MustCompile(`(?i)onload\s*=\s*['"]?[^'"]*['"]?`),
			regexp.MustCompile(`(?i)<img\b[^>]*src\s*=\s*["']?[^"'>]*["']?[^>]*onerror`),
		},
		pathTravPatterns: []*regexp.Regexp{
			regexp.MustCompile(`(\.\./|\.\.\\)`),
			regexp.MustCompile(`(%2e%2e%2f|%2e%2e\/|\.\.%2f|%2e%2e%5c)`),
			regexp.MustCompile(`(/etc/passwd|c:\\windows\\system32)`),
		},
		sensitivePatterns: []*regexp.Regexp{
			regexp.MustCompile(`(?i)\.(env|git|htaccess|aws|ssh)(/|$)`),
			regexp.MustCompile(`(?i)(wp-config\.php|settings\.py|config\.json)`),
		},
	}
}

// Analyze checks input strings across query, path, and body for attack patterns.
func (td *ThreatDetector) Analyze(path, query, body string, nowUnixMs int64) []ThreatEvent {
	var threats []ThreatEvent

	targets := []struct {
		source string
		value  string
	}{
		{"path", path},
		{"query", query},
		{"body", body},
	}

	for _, target := range targets {
		if strings.TrimSpace(target.value) == "" {
			continue
		}

		// SQLi
		for _, re := range td.sqliPatterns {
			if match := re.FindString(target.value); match != "" {
				threats = append(threats, ThreatEvent{
					ID:        fmt.Sprintf("threat-%d", nowUnixMs),
					Type:      "SQL_INJECTION",
					Severity:  "CRITICAL",
					Details:   fmt.Sprintf("Matched SQL injection pattern: %s", match),
					Source:    target.source,
					Timestamp: nowUnixMs,
				})
				break
			}
		}

		// XSS
		for _, re := range td.xssPatterns {
			if match := re.FindString(target.value); match != "" {
				threats = append(threats, ThreatEvent{
					ID:        fmt.Sprintf("threat-%d", nowUnixMs),
					Type:      "XSS",
					Severity:  "HIGH",
					Details:   fmt.Sprintf("Matched cross-site scripting pattern: %s", match),
					Source:    target.source,
					Timestamp: nowUnixMs,
				})
				break
			}
		}

		// Path Traversal
		for _, re := range td.pathTravPatterns {
			if match := re.FindString(target.value); match != "" {
				threats = append(threats, ThreatEvent{
					ID:        fmt.Sprintf("threat-%d", nowUnixMs),
					Type:      "PATH_TRAVERSAL",
					Severity:  "HIGH",
					Details:   fmt.Sprintf("Matched path traversal attempt: %s", match),
					Source:    target.source,
					Timestamp: nowUnixMs,
				})
				break
			}
		}

		// Sensitive File Access
		for _, re := range td.sensitivePatterns {
			if match := re.FindString(target.value); match != "" {
				threats = append(threats, ThreatEvent{
					ID:        fmt.Sprintf("threat-%d", nowUnixMs),
					Type:      "SENSITIVE_FILE",
					Severity:  "CRITICAL",
					Details:   fmt.Sprintf("Matched sensitive file target: %s", match),
					Source:    target.source,
					Timestamp: nowUnixMs,
				})
				break
			}
		}
	}

	return threats
}
