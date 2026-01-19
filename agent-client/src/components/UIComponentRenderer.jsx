import React from 'react';

const UIComponentRenderer = ({ component }) => {
    if (!component || !component.type) return null;

    switch (component.type) {
        case 'card':
            return (
                <div className="ui-card">
                    {component.title && <div className="ui-card-header">{component.title}</div>}
                    {component.data && (
                        <div className="ui-card-body">
                            {Object.entries(component.data).map(([key, value]) => (
                                <div key={key} className="ui-data-row">
                                    <span className="ui-data-label">{key}:</span>
                                    <span className="ui-data-value">{String(value)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    {component.actions && component.actions.length > 0 && (
                        <div className="ui-card-footer">
                            {component.actions.map((action, idx) => (
                                <button
                                    key={idx}
                                    className="ui-action-btn"
                                    onClick={() => console.log('Action clicked:', action)}
                                >
                                    {action.label || action.action}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            );

        case 'list':
            return (
                <div className="ui-list">
                    {component.title && <div className="ui-list-header">{component.title}</div>}
                    <ul className="ui-list-items">
                        {component.data && component.data.map((item, idx) => (
                            <li key={idx} className="ui-list-item">
                                {typeof item === 'object' ? JSON.stringify(item) : item}
                            </li>
                        ))}
                    </ul>
                </div>
            );

        case 'chart':
            return (
                <div className="ui-chart">
                    <div className="ui-chart-header">{component.title || 'Chart'}</div>
                    <div className="ui-chart-placeholder">
                        [Chart Visualization Placeholder]
                        <br />
                        Type: {component.chartType || 'bar'}
                    </div>
                </div>
            );

        default:
            return (
                <div className="ui-unknown">
                    <pre>{JSON.stringify(component, null, 2)}</pre>
                </div>
            );
    }
};

export default UIComponentRenderer;
