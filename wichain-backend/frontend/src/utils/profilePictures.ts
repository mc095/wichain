// Utility functions for random profile picture selection

const PROFILE_PICTURES = [
  '/pfp/2.jpg',
  '/pfp/4.jpg', 
  '/pfp/6.jpg',
  '/pfp/7.jpg',
  '/pfp/8.jpg',
  '/pfp/10.jpg',
  '/pfp/11.jpg',
  '/pfp/12.jpg',
  '/pfp/13.jpg',
  '/pfp/14.jpg',
  '/pfp/15.jpg'
];

/**
 * Get a random profile picture path for a given user ID
 * This ensures the same user always gets the same profile picture
 */
export function getRandomProfilePicture(userId: string): string {
  // Use the user ID to generate a consistent "random" selection
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Use absolute value and modulo to get index
  const index = Math.abs(hash) % PROFILE_PICTURES.length;
  return PROFILE_PICTURES[index];
}

/**
 * Get a random profile picture path for a group
 * Groups get a different set of pictures or can use the same logic
 */
export function getRandomGroupProfilePicture(groupId: string): string {
  return getRandomProfilePicture(groupId);
}

