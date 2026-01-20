import os
import sys
import time
import importlib
import threading
import traceback
import pygame
import pymunk
import pygame_gui
import google.generativeai as genai
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

# --- Configuration ---
WINDOW_SIZE = (1024, 768)
GAMES_DIR = "games"
from dotenv import load_dotenv

load_dotenv() # Load variables from .env

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# --- AI Agent ---
class AIAgent:
    def __init__(self):
        self.model = None
        if GEMINI_API_KEY:
            self.model = genai.GenerativeModel('gemini-pro')

    def suggest_fix(self, current_code, error_log, context):
        if not self.model:
            return "Error: GEMINI_API_KEY not found in environment variables."
        
        prompt = f"""
        Act as a Senior Python Game Developer. 
        I am working on a plugin for a Pygame/Pymunk engine.
        
        The Context: {context}
        
        The Code:
        ```python
        {current_code}
        ```
        
        The Error (if any) or Request:
        {error_log}
        
        Please provide the full corrected Python code for the module. 
        Return ONLY the python code inside markdown code blocks.
        """
        
        try:
            response = self.model.generate_content(prompt)
            # improved parsing to extract just the code
            text = response.text
            if "```python" in text:
                return text.split("```python")[1].split("```")[0].strip()
            elif "```" in text:
                return text.split("```")[1].split("```")[0].strip()
            return text
        except Exception as e:
            return f"# AI Error: {e}"

# --- File Watcher ---
class ReloadHandler(FileSystemEventHandler):
    def __init__(self, host):
        self.host = host
        self.last_reload = 0

    def on_modified(self, event):
        if event.src_path.endswith(".py"):
            # Debounce
            if time.time() - self.last_reload > 1.0:
                self.last_reload = time.time()
                print(f"Detected change in {event.src_path}, reloading...")
                self.host.trigger_reload()

# --- Main Host ---
class GameHost:
    def __init__(self):
        pygame.init()
        self.screen = pygame.display.set_mode(WINDOW_SIZE)
        pygame.display.set_caption("OmegaOne Python Game Console")
        self.clock = pygame.time.Clock()
        
        # UI Manager
        self.ui_manager = pygame_gui.UIManager(WINDOW_SIZE)
        self.setup_ui()
        
        # Physics & Game State
        self.space = pymunk.Space()
        self.space.gravity = (0, 900)
        self.current_game_module = None
        self.current_game_name = None
        
        # Threads/Watchers
        self.reload_queued = False
        self.ai_agent = AIAgent()
        
        # Discovery
        self.available_games = self.discover_games()
        self.populate_game_list()

        # Start loading the first game if available
        if self.available_games:
            self.load_game(self.available_games[0])

    def discover_games(self):
        games = []
        if os.path.exists(GAMES_DIR):
            for item in os.listdir(GAMES_DIR):
                if os.path.isdir(os.path.join(GAMES_DIR, item)):
                    if os.path.exists(os.path.join(GAMES_DIR, item, "logic.py")):
                        games.append(item)
        return games

    def setup_ui(self):
        self.game_list = pygame_gui.elements.UISelectionList(
            relative_rect=pygame.Rect((10, 10), (200, 300)),
            item_list=[],
            manager=self.ui_manager
        )
        
        self.console_window = pygame_gui.elements.UITextBox(
            html_text="Ready.",
            relative_rect=pygame.Rect((10, 600), (1004, 150)),
            manager=self.ui_manager
        )
        
        self.ai_btn = pygame_gui.elements.UIButton(
            relative_rect=pygame.Rect((10, 320), (200, 50)),
            text='Ask AI to Balance',
            manager=self.ui_manager
        )

    def populate_game_list(self):
        self.game_list.set_item_list(self.available_games)

    def load_game(self, game_name):
        print(f"Loading game: {game_name}")
        self.current_game_name = game_name
        self.log(f"Loading {game_name}...")
        
        # Reset physics
        self.space = pymunk.Space()
        self.space.gravity = (0, 900)
        
        try:
            module_name = f"{GAMES_DIR}.{game_name}.logic"
            if module_name in sys.modules:
                self.current_game_module = importlib.reload(sys.modules[module_name])
            else:
                self.current_game_module = importlib.import_module(module_name)
                
            # Initialize game
            if hasattr(self.current_game_module, 'setup'):
                self.current_game_module.setup(self.space)
            
            self.log(f"Loaded {game_name} successfully.")
            
        except Exception:
            self.log(f"Error loading {game_name}:\n{traceback.format_exc()}")
            self.current_game_module = None

    def trigger_reload(self):
        self.reload_queued = True

    def process_reload(self):
        if self.current_game_name:
            self.load_game(self.current_game_name)
        self.reload_queued = False

    def log(self, message):
        print(message)
        self.console_window.set_text(message)

    def run_ai_fix(self):
        if not self.current_game_name:
            return

        self.log("AI is thinking...")
        
        # Run in a thread to not block UI
        def _task():
            path = os.path.join(GAMES_DIR, self.current_game_name, "logic.py")
            with open(path, 'r') as f:
                code = f.read()
            
            new_code = self.ai_agent.suggest_fix(code, "Make this game more fun and balanced.", f"Game: {self.current_game_name}")
            
            if "Error" in new_code and len(new_code) < 100:
                # Basic error check
                pass
            else:
                 with open(path, 'w') as f:
                    f.write(new_code)
            
            # The file watcher will pick up the change and reload
        
        threading.Thread(target=_task).start()

    def run(self):
        # Watchdog setup
        observer = Observer()
        handler = ReloadHandler(self)
        observer.schedule(handler, path=".", recursive=True)
        observer.start()

        running = True
        while running:
            time_delta = self.clock.tick(60) / 1000.0

            # Event Handling
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    running = False
                
                if event.type == pygame_gui.UI_SELECTION_LIST_NEW_SELECTION:
                    if event.ui_element == self.game_list:
                        selected = self.game_list.get_single_selection()
                        if selected != self.current_game_name:
                            self.load_game(selected)
                
                if event.type == pygame_gui.UI_BUTTON_PRESSED:
                    if event.ui_element == self.ai_btn:
                        self.run_ai_fix()

                self.ui_manager.process_events(event)

            # Hot Reload Processing
            if self.reload_queued:
                self.process_reload()

            # Physics Update
            # We use a fixed time step for physics for stability, but for this simple host, just step
            self.space.step(1/60.0)
            if self.current_game_module and hasattr(self.current_game_module, 'update'):
                try:
                    self.current_game_module.update(1/60.0)
                except Exception:
                    pass # Don't crash on update error, just log once? (omitted for brevity)

            # Draw
            self.screen.fill((30, 30, 30))
            
            if self.current_game_module and hasattr(self.current_game_module, 'draw'):
                try:
                    self.current_game_module.draw(self.screen)
                except Exception:
                    pass

            self.ui_manager.update(time_delta)
            self.ui_manager.draw_ui(self.screen)
            

            pygame.display.flip()

        observer.stop()
        observer.join()
        pygame.quit()

if __name__ == "__main__":
    GameHost().run()
