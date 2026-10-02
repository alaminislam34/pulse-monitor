import { DiscoveredEndpoint } from '../types';

export const RISE_OPENAPI_METADATA = {
  title: 'Rise Productivity & Habit Formation Backend API',
  version: 'v1.4.2',
  description: 'Production-ready REST API powering habit formation, team sync, AI coaching, and deep work telemetry.',
  servers: ['http://localhost:3000/api/v1', 'https://api.risehabits.app/v1'],
  contact: 'engineering@risehabits.app',
  license: 'Apache 2.0'
};

export const DEFAULT_SWAGGER_CATALOG: DiscoveredEndpoint[] = [
  // =================== AUTH ===================
  {
    path: '/api/v1/auth/register',
    method: 'POST',
    summary: 'Register a new user account with email credentials',
    description: 'Creates a new user profile and triggers verification email.',
    tags: ['Auth'],
    operationId: 'registerUser',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['email', 'password', 'name'],
            properties: {
              email: { type: 'string', example: 'alex@example.com' },
              password: { type: 'string', example: 'P@ssw0rd2026!' },
              name: { type: 'string', example: 'Alex Morgan' },
              timezone: { type: 'string', example: 'America/New_York' }
            }
          }
        }
      }
    },
    responses: {
      '201': { description: 'User account created successfully' },
      '400': { description: 'Validation failed or email already registered' }
    }
  },
  {
    path: '/api/v1/auth/login',
    method: 'POST',
    summary: 'Authenticate credentials and obtain bearer JWT',
    description: 'Validates user password hash and returns access & refresh tokens.',
    tags: ['Auth'],
    operationId: 'loginUser',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['email', 'password'],
            properties: {
              email: { type: 'string', example: 'alex@example.com' },
              password: { type: 'string', example: 'P@ssw0rd2026!' }
            }
          }
        }
      }
    },
    responses: {
      '200': { description: 'Authentication successful, JWT tokens returned' },
      '401': { description: 'Invalid email or password' }
    }
  },
  {
    path: '/api/v1/auth/refresh',
    method: 'POST',
    summary: 'Refresh expired access token using refresh token',
    tags: ['Auth'],
    operationId: 'refreshToken',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['refreshToken'],
            properties: {
              refreshToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6Ik...' }
            }
          }
        }
      }
    },
    responses: {
      '200': { description: 'New access token issued' },
      '401': { description: 'Expired or blacklisted refresh token' }
    }
  },
  {
    path: '/api/v1/auth/google',
    method: 'POST',
    summary: 'Authenticate via Google OAuth2 ID token',
    tags: ['Auth'],
    operationId: 'loginGoogle',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['idToken'],
            properties: { idToken: { type: 'string', example: 'eyJhbGciOiJSUzI1NiIs...' } }
          }
        }
      }
    },
    responses: { '200': { description: 'Google authentication successful' } }
  },
  {
    path: '/api/v1/auth/apple',
    method: 'POST',
    summary: 'Authenticate via Apple Sign-In authorization code',
    tags: ['Auth'],
    operationId: 'loginApple',
    responses: { '200': { description: 'Apple sign-in verified' } }
  },
  {
    path: '/api/v1/auth/logout',
    method: 'POST',
    summary: 'Revoke active session token and clear cookies',
    tags: ['Auth'],
    operationId: 'logoutUser',
    responses: { '200': { description: 'Logged out successfully' } }
  },
  {
    path: '/api/v1/auth/forgot-password',
    method: 'POST',
    summary: 'Request password reset email instructions',
    tags: ['Auth'],
    operationId: 'forgotPassword',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['email'],
            properties: { email: { type: 'string', example: 'alex@example.com' } }
          }
        }
      }
    },
    responses: { '200': { description: 'Reset link dispatched' } }
  },
  {
    path: '/api/v1/auth/reset-password',
    method: 'POST',
    summary: 'Submit new password with verification token',
    tags: ['Auth'],
    operationId: 'resetPassword',
    responses: { '200': { description: 'Password reset successful' } }
  },
  {
    path: '/api/v1/auth/send-verification',
    method: 'POST',
    summary: 'Resend email address verification code',
    tags: ['Auth'],
    operationId: 'sendVerification',
    responses: { '200': { description: 'Verification code resent' } }
  },
  {
    path: '/api/v1/auth/verify-email',
    method: 'POST',
    summary: 'Confirm 6-digit email verification OTP',
    tags: ['Auth'],
    operationId: 'verifyEmail',
    responses: { '200': { description: 'Email address verified' } }
  },
  {
    path: '/api/v1/auth/me',
    method: 'GET',
    summary: 'Retrieve authenticated user session profile',
    tags: ['Auth'],
    operationId: 'getCurrentUser',
    responses: { '200': { description: 'Current user profile entity returned' } }
  },
  {
    path: '/api/v1/auth/change-password',
    method: 'PUT',
    summary: 'Update existing account password',
    tags: ['Auth'],
    operationId: 'changePassword',
    responses: { '200': { description: 'Password changed successfully' } }
  },

  // =================== USERS ===================
  {
    path: '/api/v1/users/profile',
    method: 'GET',
    summary: 'Retrieve full user profile and workspace metadata',
    tags: ['Users'],
    operationId: 'getUserProfile',
    responses: { '200': { description: 'User profile retrieved' } }
  },
  {
    path: '/api/v1/users/profile',
    method: 'PUT',
    summary: 'Update display name, bio, and locale preferences',
    tags: ['Users'],
    operationId: 'updateUserProfile',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              name: { type: 'string', example: 'Alex Morgan' },
              bio: { type: 'string', example: 'Engineering Lead & Habit Enthusiast' }
            }
          }
        }
      }
    },
    responses: { '200': { description: 'Profile updated' } }
  },
  {
    path: '/api/v1/users/account',
    method: 'DELETE',
    summary: 'Permanently delete user account and associated habit history',
    tags: ['Users'],
    operationId: 'deleteUserAccount',
    responses: { '204': { description: 'Account permanently purged' } }
  },
  {
    path: '/api/v1/users/avatar',
    method: 'POST',
    summary: 'Upload new profile picture or avatar image',
    tags: ['Users'],
    operationId: 'uploadAvatar',
    responses: { '200': { description: 'Avatar uploaded and CDN URL returned' } }
  },
  {
    path: '/api/v1/users/stats',
    method: 'GET',
    summary: 'Get consolidated user habit completion and focus stats',
    tags: ['Users'],
    operationId: 'getUserStats',
    responses: { '200': { description: 'User statistics returned' } }
  },
  {
    path: '/api/v1/users/activity',
    method: 'GET',
    summary: 'Get chronological activity stream for the user',
    tags: ['Users'],
    operationId: 'getUserActivity',
    parameters: [
      { name: 'limit', in: 'query', description: 'Maximum events to return', schema: { type: 'number' }, example: 20 },
      { name: 'page', in: 'query', description: 'Page offset number', schema: { type: 'number' }, example: 1 }
    ],
    responses: { '200': { description: 'Activity stream returned' } }
  },
  {
    path: '/api/v1/users/preferences',
    method: 'PUT',
    summary: 'Update user notification and workspace display preferences',
    tags: ['Users'],
    operationId: 'updateUserPreferences',
    responses: { '200': { description: 'Preferences saved' } }
  },
  {
    path: '/api/v1/users/onboarding',
    method: 'POST',
    summary: 'Complete onboarding walkthrough and initial goal setup',
    tags: ['Users'],
    operationId: 'completeOnboarding',
    responses: { '200': { description: 'Onboarding completed' } }
  },

  // =================== PREFERENCES ===================
  {
    path: '/api/v1/preferences',
    method: 'GET',
    summary: 'Retrieve global user preference configuration',
    tags: ['Preferences'],
    operationId: 'getPreferences',
    responses: { '200': { description: 'Preferences object' } }
  },
  {
    path: '/api/v1/preferences',
    method: 'PUT',
    summary: 'Save theme (dark/light), sound effects, and notification settings',
    tags: ['Preferences'],
    operationId: 'savePreferences',
    responses: { '200': { description: 'Settings persisted' } }
  },
  {
    path: '/api/v1/preferences/reset',
    method: 'POST',
    summary: 'Reset workspace preferences to system defaults',
    tags: ['Preferences'],
    operationId: 'resetPreferences',
    responses: { '200': { description: 'Reset complete' } }
  },

  // =================== TEAMS ===================
  {
    path: '/api/v1/teams',
    method: 'GET',
    summary: 'List all teams where the user is an active member or admin',
    tags: ['Teams'],
    operationId: 'listTeams',
    responses: { '200': { description: 'Array of user teams' } }
  },
  {
    path: '/api/v1/teams',
    method: 'POST',
    summary: 'Create a new team workspace',
    tags: ['Teams'],
    operationId: 'createTeam',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['name'],
            properties: {
              name: { type: 'string', example: 'Product Engineering' },
              description: { type: 'string', example: 'Daily standups & shared deep work' }
            }
          }
        }
      }
    },
    responses: { '201': { description: 'Team workspace created' } }
  },
  {
    path: '/api/v1/teams/{id}',
    method: 'GET',
    summary: 'Get team details, members count, and shared goals',
    tags: ['Teams'],
    operationId: 'getTeamById',
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: 'team_984' }],
    responses: { '200': { description: 'Team details entity' } }
  },
  {
    path: '/api/v1/teams/{id}',
    method: 'PUT',
    summary: 'Update team name, avatar, and description',
    tags: ['Teams'],
    operationId: 'updateTeamById',
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: 'team_984' }],
    responses: { '200': { description: 'Team details updated' } }
  },
  {
    path: '/api/v1/teams/{id}',
    method: 'DELETE',
    summary: 'Archive or disband team workspace',
    tags: ['Teams'],
    operationId: 'deleteTeamById',
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: 'team_984' }],
    responses: { '204': { description: 'Team removed' } }
  },
  {
    path: '/api/v1/teams/{id}/members',
    method: 'POST',
    summary: 'Add an existing user to team membership',
    tags: ['Teams'],
    operationId: 'addTeamMember',
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: 'team_984' }],
    responses: { '200': { description: 'Member added' } }
  },
  {
    path: '/api/v1/teams/{id}/members/{userId}',
    method: 'DELETE',
    summary: 'Remove a member from team',
    tags: ['Teams'],
    operationId: 'removeTeamMember',
    parameters: [
      { name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: 'team_984' },
      { name: 'userId', in: 'path', required: true, schema: { type: 'string' }, example: 'usr_512' }
    ],
    responses: { '204': { description: 'Member removed' } }
  },
  {
    path: '/api/v1/teams/{id}/roles',
    method: 'PUT',
    summary: 'Update member permissions (ADMIN, MEMBER, VIEWER)',
    tags: ['Teams'],
    operationId: 'updateTeamRoles',
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: 'team_984' }],
    responses: { '200': { description: 'Role privileges updated' } }
  },
  {
    path: '/api/v1/teams/{id}/invite',
    method: 'POST',
    summary: 'Send invitation link to prospective team member',
    tags: ['Teams'],
    operationId: 'inviteTeamMember',
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: 'team_984' }],
    responses: { '200': { description: 'Invitation sent' } }
  },

  // =================== GOALS ===================
  {
    path: '/api/v1/goals',
    method: 'GET',
    summary: 'List user active, completed, and archived goals',
    tags: ['Goals'],
    operationId: 'listGoals',
    parameters: [{ name: 'status', in: 'query', schema: { type: 'string' }, example: 'ACTIVE' }],
    responses: { '200': { description: 'List of goals' } }
  },
  {
    path: '/api/v1/goals',
    method: 'POST',
    summary: 'Create a new quarterly or annual objective',
    tags: ['Goals'],
    operationId: 'createGoal',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['title', 'targetDate'],
            properties: {
              title: { type: 'string', example: 'Ship Mobile App v2.0' },
              targetDate: { type: 'string', example: '2026-12-31' },
              category: { type: 'string', example: 'CAREER' }
            }
          }
        }
      }
    },
    responses: { '201': { description: 'Goal created' } }
  },
  {
    path: '/api/v1/goals/{id}',
    method: 'GET',
    summary: 'Retrieve goal progress, milestone timeline, and linked habits',
    tags: ['Goals'],
    operationId: 'getGoalById',
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: 'goal_77' }],
    responses: { '200': { description: 'Goal entity details' } }
  },
  {
    path: '/api/v1/goals/{id}',
    method: 'PUT',
    summary: 'Update goal title, target metric, or deadline',
    tags: ['Goals'],
    operationId: 'updateGoalById',
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: 'goal_77' }],
    responses: { '200': { description: 'Goal updated' } }
  },
  {
    path: '/api/v1/goals/{id}',
    method: 'DELETE',
    summary: 'Delete or archive goal',
    tags: ['Goals'],
    operationId: 'deleteGoalById',
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: 'goal_77' }],
    responses: { '204': { description: 'Goal removed' } }
  },
  {
    path: '/api/v1/goals/{id}/milestones',
    method: 'POST',
    summary: 'Append a checkpoint milestone to a goal',
    tags: ['Goals'],
    operationId: 'addGoalMilestone',
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: 'goal_77' }],
    responses: { '201': { description: 'Milestone added' } }
  },

  // =================== HABITS ===================
  {
    path: '/api/v1/habits',
    method: 'GET',
    summary: 'List daily and weekly recurring habits',
    tags: ['Habits'],
    operationId: 'listHabits',
    responses: { '200': { description: 'Array of habit routines' } }
  },
  {
    path: '/api/v1/habits',
    method: 'POST',
    summary: 'Create a new recurring habit routine',
    tags: ['Habits'],
    operationId: 'createHabit',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['title', 'frequency'],
            properties: {
              title: { type: 'string', example: 'Morning Deep Reading (30 mins)' },
              frequency: { type: 'string', example: 'DAILY' },
              reminderTime: { type: 'string', example: '07:30' }
            }
          }
        }
      }
    },
    responses: { '201': { description: 'Habit registered' } }
  },
  {
    path: '/api/v1/habits/{id}',
    method: 'GET',
    summary: 'Get single habit details, cadence stats, and streak history',
    tags: ['Habits'],
    operationId: 'getHabitById',
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: 'hab_102' }],
    responses: { '200': { description: 'Habit data with streaks' } }
  },
  {
    path: '/api/v1/habits/{id}',
    method: 'PUT',
    summary: 'Update habit reminder time or target completion frequency',
    tags: ['Habits'],
    operationId: 'updateHabitById',
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: 'hab_102' }],
    responses: { '200': { description: 'Habit updated' } }
  },
  {
    path: '/api/v1/habits/{id}',
    method: 'DELETE',
    summary: 'Archive or stop tracking a habit',
    tags: ['Habits'],
    operationId: 'deleteHabitById',
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: 'hab_102' }],
    responses: { '204': { description: 'Habit archived' } }
  },
  {
    path: '/api/v1/habits/{id}/log',
    method: 'POST',
    summary: 'Log completion check-in for habit today',
    tags: ['Habits'],
    operationId: 'logHabitCompletion',
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: 'hab_102' }],
    requestBody: {
      required: false,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              completedAt: { type: 'string', example: '2026-10-02T15:30:00Z' },
              note: { type: 'string', example: 'Read 25 pages of System Design' }
            }
          }
        }
      }
    },
    responses: { '200': { description: 'Check-in recorded and streak incremented' } }
  },

  // =================== STREAK TRACKING ===================
  {
    path: '/api/v1/streaks',
    method: 'GET',
    summary: 'Get current active streak counts across all habits',
    tags: ['Streak Tracking'],
    operationId: 'getStreaks',
    responses: { '200': { description: 'Streak counts and longest streak record' } }
  },
  {
    path: '/api/v1/streaks/leaderboard',
    method: 'GET',
    summary: 'Get top streak rankings among team or friends',
    tags: ['Streak Tracking'],
    operationId: 'getStreakLeaderboard',
    responses: { '200': { description: 'Leaderboard list' } }
  },
  {
    path: '/api/v1/streaks/freeze',
    method: 'POST',
    summary: 'Redeem or activate streak freeze safeguard',
    tags: ['Streak Tracking'],
    operationId: 'activateStreakFreeze',
    responses: { '200': { description: 'Streak freeze activated for 24h' } }
  },

  // =================== FOCUS MODE ===================
  {
    path: '/api/v1/focus/session/start',
    method: 'POST',
    summary: 'Start an active deep work or Pomodoro timer session',
    tags: ['Focus Mode'],
    operationId: 'startFocusSession',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['durationMinutes'],
            properties: {
              durationMinutes: { type: 'number', example: 45 },
              tag: { type: 'string', example: 'Coding' }
            }
          }
        }
      }
    },
    responses: { '201': { description: 'Focus session started' } }
  },
  {
    path: '/api/v1/focus/session/end',
    method: 'POST',
    summary: 'Complete or prematurely stop current focus session',
    tags: ['Focus Mode'],
    operationId: 'endFocusSession',
    responses: { '200': { description: 'Session completed and logged to stats' } }
  },
  {
    path: '/api/v1/focus/stats',
    method: 'GET',
    summary: 'Retrieve daily/weekly deep work minutes distribution',
    tags: ['Focus Mode'],
    operationId: 'getFocusStats',
    responses: { '200': { description: 'Focus duration statistics' } }
  },
  {
    path: '/api/v1/focus/settings',
    method: 'PUT',
    summary: 'Configure default focus intervals, short/long breaks and soundscapes',
    tags: ['Focus Mode'],
    operationId: 'updateFocusSettings',
    responses: { '200': { description: 'Focus configuration updated' } }
  },

  // =================== GAMIFICATION ===================
  {
    path: '/api/v1/gamification/profile',
    method: 'GET',
    summary: 'Get player level, XP progress, and title rank',
    tags: ['Gamification'],
    operationId: 'getGamificationProfile',
    responses: { '200': { description: 'XP points and tier rank' } }
  },
  {
    path: '/api/v1/gamification/badges',
    method: 'GET',
    summary: 'List all unlockable badges and user achievement status',
    tags: ['Gamification'],
    operationId: 'getBadges',
    responses: { '200': { description: 'Badges and unlocks' } }
  },
  {
    path: '/api/v1/gamification/leaderboard',
    method: 'GET',
    summary: 'Global XP standings and weekly cohort rankings',
    tags: ['Gamification'],
    operationId: 'getGamificationLeaderboard',
    responses: { '200': { description: 'Rankings table' } }
  },
  {
    path: '/api/v1/gamification/claim-reward',
    method: 'POST',
    summary: 'Claim weekly milestone bonus XP or cosmetic badge',
    tags: ['Gamification'],
    operationId: 'claimReward',
    responses: { '200': { description: 'Reward credited to account' } }
  },

  // =================== NOTION SYNC ===================
  {
    path: '/api/v1/sync/notion/connect',
    method: 'POST',
    summary: 'Initiate OAuth handshake with user Notion workspace',
    tags: ['Notion Sync'],
    operationId: 'connectNotion',
    responses: { '200': { description: 'OAuth URL returned' } }
  },
  {
    path: '/api/v1/sync/notion/sync',
    method: 'POST',
    summary: 'Trigger immediate bidirectional sync between Rise and Notion DB',
    tags: ['Notion Sync'],
    operationId: 'triggerNotionSync',
    responses: { '200': { description: 'Sync job enqueued' } }
  },
  {
    path: '/api/v1/sync/notion/status',
    method: 'GET',
    summary: 'Check status of last Notion synchronization job',
    tags: ['Notion Sync'],
    operationId: 'getNotionSyncStatus',
    responses: { '200': { description: 'Sync status and timestamps' } }
  },
  {
    path: '/api/v1/sync/notion/disconnect',
    method: 'DELETE',
    summary: 'Revoke Notion API authorization token',
    tags: ['Notion Sync'],
    operationId: 'disconnectNotion',
    responses: { '204': { description: 'Notion disconnected' } }
  },

  // =================== GROWTH ===================
  {
    path: '/api/v1/growth/insights',
    method: 'GET',
    summary: 'Retrieve weekly productivity retrospectives & AI insights',
    tags: ['Growth'],
    operationId: 'getGrowthInsights',
    responses: { '200': { description: 'Insights report' } }
  },
  {
    path: '/api/v1/growth/analytics',
    method: 'GET',
    summary: 'Habit retention curves and completion consistency ratios',
    tags: ['Growth'],
    operationId: 'getGrowthAnalytics',
    responses: { '200': { description: 'Analytics breakdown' } }
  },
  {
    path: '/api/v1/growth/feedback',
    method: 'POST',
    summary: 'Submit weekly retrospective self-reflection',
    tags: ['Growth'],
    operationId: 'submitGrowthFeedback',
    responses: { '201': { description: 'Reflection saved' } }
  },

  // =================== SUBSCRIPTIONS ===================
  {
    path: '/api/v1/subscriptions/plans',
    method: 'GET',
    summary: 'List available Rise Pro, Team, and Enterprise pricing tiers',
    tags: ['Subscriptions'],
    operationId: 'getSubscriptionPlans',
    responses: { '200': { description: 'Pricing plans and features matrix' } }
  },
  {
    path: '/api/v1/subscriptions/checkout',
    method: 'POST',
    summary: 'Create Stripe checkout session for Pro upgrade',
    tags: ['Subscriptions'],
    operationId: 'createSubscriptionCheckout',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['planId'],
            properties: { planId: { type: 'string', example: 'plan_pro_annual' } }
          }
        }
      }
    },
    responses: { '200': { description: 'Stripe redirect URL generated' } }
  },
  {
    path: '/api/v1/subscriptions/status',
    method: 'GET',
    summary: 'Verify active billing status, next invoice date, and seat quotas',
    tags: ['Subscriptions'],
    operationId: 'getSubscriptionStatus',
    responses: { '200': { description: 'Current billing entity' } }
  },
  {
    path: '/api/v1/subscriptions/cancel',
    method: 'POST',
    summary: 'Cancel renewal of current subscription tier',
    tags: ['Subscriptions'],
    operationId: 'cancelSubscription',
    responses: { '200': { description: 'Subscription marked for termination at period end' } }
  },
  {
    path: '/api/v1/subscriptions/resume',
    method: 'POST',
    summary: 'Resume auto-renewal before subscription expiration',
    tags: ['Subscriptions'],
    operationId: 'resumeSubscription',
    responses: { '200': { description: 'Subscription restored' } }
  },

  // =================== AI ASSISTANT ===================
  {
    path: '/api/v1/ai/chat',
    method: 'POST',
    summary: 'Interactive AI coaching dialogue for habit optimization',
    tags: ['AI Assistant'],
    operationId: 'aiChatPrompt',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['message'],
            properties: { message: { type: 'string', example: 'How can I build a consistent morning coding routine?' } }
          }
        }
      }
    },
    responses: { '200': { description: 'AI stream response and coaching tip' } }
  },
  {
    path: '/api/v1/ai/generate-plan',
    method: 'POST',
    summary: 'Generate tailored 30-day habit roadmap from user goal',
    tags: ['AI Assistant'],
    operationId: 'aiGeneratePlan',
    responses: { '200': { description: 'Structured milestone plan' } }
  },
  {
    path: '/api/v1/ai/habit-coach',
    method: 'POST',
    summary: 'Get algorithmic nudge advice for broken streak recovery',
    tags: ['AI Assistant'],
    operationId: 'aiHabitCoach',
    responses: { '200': { description: 'Nudge suggestions' } }
  },
  {
    path: '/api/v1/ai/suggestions',
    method: 'GET',
    summary: 'List contextual habit recommendations based on calendar load',
    tags: ['AI Assistant'],
    operationId: 'aiGetSuggestions',
    responses: { '200': { description: 'Contextual recommendations' } }
  },

  // =================== ANALYTICS ===================
  {
    path: '/api/v1/analytics/overview',
    method: 'GET',
    summary: 'High-level dashboard metrics (Total habits, streak avg, focus hrs)',
    tags: ['Analytics'],
    operationId: 'getAnalyticsOverview',
    responses: { '200': { description: 'Overview statistics' } }
  },
  {
    path: '/api/v1/analytics/habits',
    method: 'GET',
    summary: 'Detailed completion rate per category and weekday',
    tags: ['Analytics'],
    operationId: 'getHabitAnalytics',
    responses: { '200': { description: 'Detailed habit metric charts' } }
  },
  {
    path: '/api/v1/analytics/focus',
    method: 'GET',
    summary: 'Deep work focus hours distribution across tags',
    tags: ['Analytics'],
    operationId: 'getFocusAnalytics',
    responses: { '200': { description: 'Focus metrics breakdown' } }
  },
  {
    path: '/api/v1/analytics/export',
    method: 'GET',
    summary: 'Export complete user data audit package (CSV / JSON)',
    tags: ['Analytics'],
    operationId: 'exportAnalyticsData',
    parameters: [{ name: 'format', in: 'query', schema: { type: 'string' }, example: 'json' }],
    responses: { '200': { description: 'ZIP archive download' } }
  },

  // =================== SUPPORT ===================
  {
    path: '/api/v1/support/tickets',
    method: 'POST',
    summary: 'Open a customer support ticket with logs attachment',
    tags: ['Support'],
    operationId: 'createSupportTicket',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['subject', 'message'],
            properties: {
              subject: { type: 'string', example: 'Notion Sync timeout on large database' },
              message: { type: 'string', example: 'Encountering 504 error during initial database export.' }
            }
          }
        }
      }
    },
    responses: { '201': { description: 'Ticket created with tracking ID' } }
  },
  {
    path: '/api/v1/support/tickets',
    method: 'GET',
    summary: 'List user active and resolved support inquiries',
    tags: ['Support'],
    operationId: 'listSupportTickets',
    responses: { '200': { description: 'List of support tickets' } }
  },
  {
    path: '/api/v1/support/feedback',
    method: 'POST',
    summary: 'Submit in-app product feedback and feature requests',
    tags: ['Support'],
    operationId: 'submitFeedback',
    responses: { '201': { description: 'Feedback received' } }
  },

  // =================== ADMIN ===================
  {
    path: '/api/v1/admin/users',
    method: 'GET',
    summary: 'System admin: Search, filter, and paginate all platform users',
    tags: ['Admin'],
    operationId: 'adminGetUsers',
    parameters: [
      { name: 'search', in: 'query', schema: { type: 'string' }, example: 'alex' },
      { name: 'role', in: 'query', schema: { type: 'string' }, example: 'USER' }
    ],
    responses: { '200': { description: 'Admin user query results' } }
  },
  {
    path: '/api/v1/admin/stats',
    method: 'GET',
    summary: 'Platform health, DAU/MAU, Redis cache hit ratio, queue lengths',
    tags: ['Admin'],
    operationId: 'adminGetStats',
    responses: { '200': { description: 'Platform health telemetry' } }
  },
  {
    path: '/api/v1/admin/users/{id}/ban',
    method: 'PUT',
    summary: 'Ban or reinstate user account access',
    tags: ['Admin'],
    operationId: 'adminBanUser',
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: 'usr_882' }],
    responses: { '200': { description: 'User account status altered' } }
  },
  {
    path: '/api/v1/admin/cache',
    method: 'DELETE',
    summary: 'Flush in-memory and Redis application cache keys',
    tags: ['Admin'],
    operationId: 'adminFlushCache',
    responses: { '200': { description: 'Cache invalidated' } }
  }
];
