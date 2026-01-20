# OmegaOne Python Game Console

## Overview

OmegaOne is a modular, hot-reloading game engine built on top of **Pygame** (rendering) and **Pymunk** (physics). It is designed to host multiple mini-games (plugins) that can be developed, tested, and modified in real-time.

The platform includes two advanced features:
1.  **Hot Reloading:** Modify your game code while the engine is running, and changes are reflected immediately without restarting the host.
2.  **AI Integration:** An "Ask AI" feature (powered by Google Gemini) that can analyze your game code and suggest fixes or balance adjustments.

## Architecture

The system is divided into two main components: the **Host** and the **Games**.

### The Host (`host.py`)
The Host acts as the operating system for the games. Its responsibilities include:
-   **Window & Input Management:** Handles the Pygame window, event loop, and UI (using `pygame_gui`).
-   **Physics World:** Maintains the `pymunk.Space` (gravity, collision handling) which is shared with the active game.
-   **Game Loading:** Dynamically imports and reloads game modules from the `games/` directory.
-   **The Loop:**
    1.  Steps the physics simulation.
    2.  Calls the active game's `update()` method.
    3.  Clears the screen.
    4.  Calls the active game's `draw()` method.
    5.  Draws the Host UI on top.

### The Game Interface (`game_interface.py`)
While not strictly enforced via inheritance in the dynamic loader, all games are expected to adhere to the `GameInterface` contract. This decoupling allows games to be simple Python scripts focusing purely on logic.

## Game Development Guide

To create a new game, you act as a plugin developer.

### 1. Folder Structure
Create a new directory inside the `games/` folder. The name of the directory will be the name of your game. Inside that directory, create a `logic.py` file.

Example:
```
games/
  └── my_cool_game/
      └── logic.py
```

### 2. Implementing Logic (`logic.py`)
Your `logic.py` must implement three specific functions:

#### `setup(space: pymunk.Space)`
Called when the game is loaded or reloaded.
-   **Input:** The Pymunk physics space provided by the host.
-   **Goal:** Create bodies, shapes, and joints and add them to the `space`. Initialize your global state (e.g., reset scores, clear old objects).
-   *Note: The Host clears the physics space before calling this, so you don't need to manually remove old physics objects.*

#### `update(dt: float)`
Called once per frame (approx. 60 times/second).
-   **Input:** Delta time (seconds) since the last frame.
-   **Goal:** Run non-physics game logic (e.g., input handling, AI, timers, win conditions).

#### `draw(screen: pygame.Surface)`
Called once per frame after the update.
-   **Input:** The main Pygame display surface.
-   **Goal:** Render your game objects. You can use standard Pygame draw commands (lines, circles, blits). You usually need to read positions from your physics objects created in `setup`.

### Example Template
```python
import pymunk
import pygame

# Global state to hold references to our objects
game_state = {}

def setup(space: pymunk.Space):
    global game_state

    # 1. Create a physics body
    body = pymunk.Body(mass=1, moment=10)
    body.position = (500, 300)

    # 2. Create a shape
    shape = pymunk.Circle(body, radius=20)
    shape.elasticity = 0.8

    # 3. Add to space
    space.add(body, shape)

    # 4. Save reference for drawing
    game_state['ball'] = body

def update(dt):
    # Physics is handled automatically by the host!
    # Add custom logic here if needed.
    pass

def draw(screen: pygame.Surface):
    ball_body = game_state.get('ball')
    if ball_body:
        pos = ball_body.position
        # Draw the visual representation of the physics body
        pygame.draw.circle(screen, (255, 0, 0), (int(pos.x), int(pos.y)), 20)
```

## Setup & Installation

1.  **Install Dependencies:**
    Ensure you have Python installed, then run:
    ```bash
    pip install -r requirements.txt
    ```

2.  **Environment Variables (Optional):**
    If you wish to use the AI features, create a `.env` file in the root directory and add your Google Gemini API key:
    ```
    GEMINI_API_KEY=your_api_key_here
    ```

3.  **Run the Host:**
    ```bash
    python host.py
    ```

## Development Workflow
1.  Launch `host.py`.
2.  Select your game from the list.
3.  Open `games/<your_game>/logic.py` in your favorite text editor.
4.  Make a change (e.g., change a color or physics property).
5.  Save the file.
6.  The Host detects the change, reloads the module, and resets the simulation immediately.
