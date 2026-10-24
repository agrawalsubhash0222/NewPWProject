pipeline {
  agent any
  stages {
    stage('Install') {
      steps {
        bat 'npm ci'
        bat 'npx playwright install'
      }
    }
    stage('Test') {
      steps { bat 'npx playwright test' }
    }
  }
  post {
    always {
      archiveArtifacts artifacts: 'playwright-report/**, test-results/**', allowEmptyArchive: true
    }
  }
}