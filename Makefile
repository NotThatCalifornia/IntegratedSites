# Super simple static file server for this folder

.PHONY: launch

# Default port if none provided
PORT ?= 80

# Allow positional port: `make launch 8080`
# Capture any extra make goals other than `launch` as arguments
ARGS := $(filter-out launch,$(MAKECMDGOALS))

launch:
	@port="$(if $(strip $(firstword $(ARGS))),$(firstword $(ARGS)),$(PORT))"; \
	echo "Launching static server at http://0.0.0.0:$$port (root: $$PWD)"; \
	if command -v python3 >/dev/null 2>&1; then \
		exec python3 -m http.server $$port --bind 0.0.0.0; \
	elif command -v python >/dev/null 2>&1; then \
		pyver=$$(python -c 'import sys; print(sys.version_info[0])'); \
			if [ "$$pyver" = "3" ]; then \
				exec python -m http.server $$port --bind 0.0.0.0; \
			else \
				echo "Python 2 detected; falling back to SimpleHTTPServer (no bind option)"; \
				exec python -m SimpleHTTPServer $$port; \
			fi; \
	elif command -v php >/dev/null 2>&1; then \
		exec php -S 0.0.0.0:$$port -t .; \
	elif command -v ruby >/dev/null 2>&1; then \
		exec ruby -run -e httpd . -p $$port -b 0.0.0.0; \
	else \
		echo "No suitable runtime found (python3, python, php, ruby)."; \
		exit 1; \
	fi

# Swallow unknown goals (e.g., the positional port like `8080`)
%:
	@:
