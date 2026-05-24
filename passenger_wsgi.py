import sys
import os

# Add your project directory to the sys.path
project_home = os.path.dirname(__file__)
if project_home not in sys.path:
    sys.path.insert(0, project_home)

# Set up virtual environment
VENV_PATH = os.path.join(project_home, 'venv', 'bin', 'activate_this.py')
if os.path.exists(VENV_PATH):
    exec(open(VENV_PATH).read(), {'__file__': VENV_PATH})

# Load environment variables from .env if it exists
env_file = os.path.join(project_home, '.env')
if os.path.exists(env_file):
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ.setdefault(key.strip(), value.strip())

# Import your Flask application (after loading env vars)
from server import app as application

# Also expose as 'app' for compatibility
app = application
