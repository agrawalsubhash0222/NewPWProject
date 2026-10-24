pipeline {
  agent any

  parameters {
    choice(name: 'ENVIRONMENT', choices: ['qa', 'staging', 'prod'], description: 'Environment')
    choice(name: 'TAG', choices: ['@smoke', '@regression', 'all'], description: 'Test suite')
  }

  environment {
    CI = 'true'
    PLAYWRIGHT_HTML_OPEN = 'never'
    PLAYWRIGHT_JUNIT_OUTPUT_NAME = 'results/junit.xml'
    BASE_URL = "${params.ENVIRONMENT == 'qa' ? 'https://www.saucedemo.com' : params.ENVIRONMENT == 'staging' ? 'https://staging.example.com' : 'https://prod.example.com'}"
  }

  stages {
    stage('Install') {
      steps {
        bat 'npm ci'
        bat 'npx playwright install chromium'
      }
    }
    stage('Test') {
      steps {
        bat "npx playwright test ${params.TAG == 'all' ? '' : '--grep ' + params.TAG} --reporter=list,html,junit"
      }
    }
  }

  post {
    always {
      junit testResults: 'results/junit.xml', allowEmptyResults: true
      archiveArtifacts artifacts: 'playwright-report/**, test-results/**', allowEmptyArchive: true
    }
  }
}