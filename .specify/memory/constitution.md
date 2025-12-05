<!--
  ============================================================================
  SYNC IMPACT REPORT
  ============================================================================
  Version change: 1.0.0 → 1.1.0

  Modified principles: None

  Added sections:
    - Principle VI: Langue Française
    - Principle VII: Harmonie Esthétique

  Removed sections: None

  Templates status:
    - .specify/templates/plan-template.md: ✅ compatible
    - .specify/templates/spec-template.md: ✅ compatible
    - .specify/templates/tasks-template.md: ✅ compatible

  Follow-up TODOs: None
  ============================================================================
-->

# News Project Constitution

## Core Principles

### I. TDD First (NON-NEGOTIABLE)

Test-Driven Development is mandatory for all feature implementation.

- Tests MUST be written before implementation code
- All tests MUST fail initially (Red phase) before any production code is written
- Implementation MUST only contain code necessary to pass the tests (Green phase)
- Refactoring MUST maintain all tests passing (Refactor phase)
- No pull request will be merged without corresponding tests
- Code coverage MUST be maintained above 80% for critical paths

**Rationale**: TDD ensures requirements are captured as executable specifications,
reduces defect density, and produces inherently testable architectures.

### II. Security by Design

Security MUST be integrated from the design phase, not added as an afterthought.

- All user inputs MUST be validated and sanitized
- Authentication and authorization MUST be implemented for all protected resources
- Sensitive data MUST be encrypted at rest and in transit
- OWASP Top 10 vulnerabilities MUST be addressed in code reviews
- Dependencies MUST be regularly audited for known vulnerabilities
- Secrets MUST never be committed to version control

**Rationale**: Security breaches are exponentially more costly to fix post-deployment.
Proactive security reduces risk and maintains user trust.

### III. Performance First

Performance requirements MUST be defined and validated continuously.

- Performance budgets MUST be established before implementation
- Critical paths MUST have defined latency targets (e.g., p95 < 200ms)
- Database queries MUST be optimized and indexed appropriately
- Memory usage MUST be monitored and bounded
- Load testing MUST validate system behavior under expected peak conditions
- Performance regressions MUST block deployment

**Rationale**: Performance directly impacts user experience and operational costs.
Early performance consideration prevents costly architectural rewrites.

### IV. SOLID Code

All code MUST adhere to SOLID principles for maintainability and extensibility.

- **Single Responsibility**: Each module/class MUST have one reason to change
- **Open/Closed**: Modules MUST be open for extension, closed for modification
- **Liskov Substitution**: Subtypes MUST be substitutable for their base types
- **Interface Segregation**: Clients MUST NOT depend on interfaces they don't use
- **Dependency Inversion**: High-level modules MUST NOT depend on low-level modules;
  both MUST depend on abstractions

Code reviews MUST verify SOLID compliance. Violations require documented justification.

**Rationale**: SOLID principles reduce coupling, improve testability, and enable
sustainable evolution of the codebase over time.

### V. Usability (Ergonomie)

User experience MUST be a primary design consideration for all interfaces.

- User workflows MUST be validated with real usage scenarios
- Error messages MUST be clear, actionable, and user-friendly
- CLI tools MUST provide helpful feedback and --help documentation
- API responses MUST follow consistent, predictable conventions
- UI components MUST be accessible (WCAG 2.1 AA compliance where applicable)
- Progressive disclosure: simple by default, powerful when needed

**Rationale**: Software exists to serve users. Confusing interfaces waste time
and erode adoption regardless of technical excellence.

### VI. Langue Française

Tout le projet DOIT être rédigé en français.

- Le code source DOIT utiliser des noms de variables, fonctions et classes en français
- Les commentaires DOIVENT être rédigés en français
- La documentation DOIT être entièrement en français
- Les messages d'erreur et logs DOIVENT être en français
- Les commits et pull requests DOIVENT être décrits en français
- Les noms de fichiers et dossiers DOIVENT être en français (sauf contraintes techniques)

**Rationale**: La cohérence linguistique facilite la compréhension, la collaboration
et la maintenance par l'équipe francophone.

### VII. Harmonie Esthétique

Tout le code et les interfaces DOIVENT être beaux et harmonieux.

- Le code DOIT suivre un style cohérent et élégant (formatage automatique obligatoire)
- Les interfaces utilisateur DOIVENT respecter une charte graphique unifiée
- Les couleurs, typographies et espacements DOIVENT être cohérents
- Le code DOIT être visuellement aéré : espacement logique, indentation claire
- Les nommages DOIVENT être expressifs et symétriques dans leur structure
- Les patterns de code DOIVENT être uniformes à travers tout le projet

**Rationale**: Un code beau est un code maintenable. L'harmonie visuelle réduit
la charge cognitive et reflète une pensée ordonnée.

## Quality Gates

All code changes MUST pass these gates before merge:

1. **Test Gate**: All tests pass, no test regressions, coverage thresholds met
2. **Security Gate**: No new vulnerabilities, secrets scan clean
3. **Performance Gate**: No performance regressions on critical paths
4. **Code Quality Gate**: Linting passes, SOLID principles respected
5. **Review Gate**: At least one peer review with explicit approval
6. **Language Gate**: All content in French, naming conventions respected
7. **Aesthetic Gate**: Code formatting validated, visual consistency verified

## Development Workflow

### Branching Strategy

- Feature branches from `main` with descriptive names
- Small, focused commits with clear messages
- Rebase before merge to maintain linear history

### Code Review Requirements

- All changes require review before merge
- Reviewers MUST verify compliance with all seven core principles
- Constructive feedback with specific improvement suggestions
- No merge without explicit approval

### Continuous Integration

- All tests run on every push
- Security scans on every pull request
- Performance benchmarks on critical path changes
- Deployment blocked on any gate failure

## Governance

This constitution supersedes all other development practices and guidelines.

### Amendment Procedure

1. Propose changes via pull request to this document
2. Changes require documented rationale
3. Team discussion and consensus required
4. Version increment follows semantic versioning:
   - MAJOR: Principle removal or incompatible redefinition
   - MINOR: New principle or significant guidance expansion
   - PATCH: Clarifications, wording improvements
5. Migration plan required for breaking changes

### Compliance

- All pull requests MUST be verified against this constitution
- Violations MUST be documented and justified if exceptions are granted
- Periodic reviews to ensure constitution relevance

**Version**: 1.1.0 | **Ratified**: 2025-12-05 | **Last Amended**: 2025-12-05
