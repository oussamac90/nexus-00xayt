{{/*
Expand the name of the chart.
*/}}
{{- define "nexus.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "nexus.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "nexus.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "nexus.labels" -}}
helm.sh/chart: {{ include "nexus.chart" . }}
{{ include "nexus.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/environment: {{ .Values.global.environment | default "development" }}
app.kubernetes.io/region: {{ .Values.global.region | default "default" }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "nexus.selectorLabels" -}}
app.kubernetes.io/name: {{ include "nexus.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "nexus.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "nexus.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Generate security context for pods
*/}}
{{- define "nexus.podSecurityContext" -}}
fsGroup: 1000
runAsUser: 1000
runAsNonRoot: true
seccompProfile:
  type: RuntimeDefault
{{- end }}

{{/*
Generate security context for containers
*/}}
{{- define "nexus.containerSecurityContext" -}}
allowPrivilegeEscalation: false
capabilities:
  drop:
  - ALL
readOnlyRootFilesystem: true
runAsNonRoot: true
runAsUser: 1000
seccompProfile:
  type: RuntimeDefault
{{- end }}

{{/*
Generate monitoring annotations
*/}}
{{- define "nexus.monitoringAnnotations" -}}
{{- if .Values.global.monitoring.enabled }}
prometheus.io/scrape: "true"
prometheus.io/port: "{{ .Values.monitoring.port | default "8080" }}"
prometheus.io/path: "{{ .Values.monitoring.path | default "/metrics" }}"
prometheus.io/scheme: "{{ .Values.monitoring.scheme | default "http" }}"
{{- end }}
{{- end }}

{{/*
Generate regional resource name
*/}}
{{- define "nexus.regionalName" -}}
{{- $name := include "nexus.fullname" . -}}
{{- $region := .Values.global.region | default "default" -}}
{{- printf "%s-%s" $region $name | trunc 63 | trimSuffix "-" -}}
{{- end }}

{{/*
Generate environment-specific resource name
*/}}
{{- define "nexus.environmentName" -}}
{{- $name := include "nexus.fullname" . -}}
{{- $env := .Values.global.environment | default "development" -}}
{{- printf "%s-%s" $env $name | trunc 63 | trimSuffix "-" -}}
{{- end }}

{{/*
Generate service monitor labels
*/}}
{{- define "nexus.serviceMonitorLabels" -}}
{{- if .Values.global.monitoring.prometheus.serviceMonitor }}
monitoring.nexus.com/enabled: "true"
monitoring.nexus.com/scrape: "true"
monitoring.nexus.com/port: "{{ .Values.monitoring.port | default "8080" }}"
monitoring.nexus.com/path: "{{ .Values.monitoring.path | default "/metrics" }}"
{{- end }}
{{- end }}

{{/*
Generate pod anti-affinity rules
*/}}
{{- define "nexus.podAntiAffinity" -}}
podAntiAffinity:
  preferredDuringSchedulingIgnoredDuringExecution:
  - weight: 100
    podAffinityTerm:
      labelSelector:
        matchExpressions:
        - key: app.kubernetes.io/name
          operator: In
          values:
          - {{ include "nexus.name" . }}
        - key: app.kubernetes.io/instance
          operator: In
          values:
          - {{ .Release.Name }}
      topologyKey: kubernetes.io/hostname
{{- end }}

{{/*
Generate node affinity rules
*/}}
{{- define "nexus.nodeAffinity" -}}
nodeAffinity:
  requiredDuringSchedulingIgnoredDuringExecution:
    nodeSelectorTerms:
    - matchExpressions:
      - key: kubernetes.io/region
        operator: In
        values:
        - {{ .Values.global.region | default "default" }}
{{- end }}

{{/*
Generate resource requests/limits
*/}}
{{- define "nexus.resources" -}}
{{- if .Values.resources }}
resources:
  {{- toYaml .Values.resources | nindent 2 }}
{{- end }}
{{- end }}

{{/*
Generate ingress TLS configuration
*/}}
{{- define "nexus.ingressTLS" -}}
{{- if .Values.global.security.tls.enabled }}
tls:
  - hosts:
      - {{ .Values.global.domain }}
      {{- range .Values.ingress.additionalHosts }}
      - {{ . }}
      {{- end }}
    secretName: {{ include "nexus.fullname" . }}-tls
{{- end }}
{{- end }}