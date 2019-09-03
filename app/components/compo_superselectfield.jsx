const React = require('react');
const SuperSelectField = require('material-ui-superselectfield');
const MuiThemeProvider = require('material-ui/styles/MuiThemeProvider').default;
const getMuiTheme = require('material-ui/styles/getMuiTheme').default;
const { equal } = require('@aux/aux_global.js');

const muiTheme = getMuiTheme({
   fontFamily: 'inherit',
});

// https://github.com/Sharlaan/material-ui-superselectfield

const _handleCustomDisplaySelections = (values, name) => {
   return <span>{values && values.value ? values.value : 'none'}</span>;
};

const _dataDisplayItem = item => {
   return (
      <option key={item.value} value={item.value} label={item.label}>
         {item.label}
      </option>
   );
};

class Superselectfield extends React.Component {
   constructor(props) {
      super(props);

      this.state = {
         data: [],
         search: '',
         selection: props.value || null,
      };

      this.handleSelection = value => {
         if (!value) return;
         if (equal(value, this.state.selection)) return;
         if (this.props.onChange) {
            this.props.onChange(value);
         }
         this.setState({ selection: value });
      };
   }

   componentDidMount() {
      this.setState({ data: this.props.options || [] });
   }

   render() {
      const { data, search, selection } = this.state;
      const handleCustomDisplaySelections = this.props.handleCustomDisplaySelections || _handleCustomDisplaySelections;
      const dataDisplayItem = this.props.dataDisplayItem || _dataDisplayItem;
      const dataDisplay = data.map(dataDisplayItem);
      const popoverWidth = this.props.popoverWidth || 180;

      return (
         <MuiThemeProvider muiTheme={muiTheme}>
            <div className="superSelectField">
               <SuperSelectField
                  popoverClassName={this.props.popoverClassName || 'superSelectFieldMenu'}
                  value={selection}
                  onChange={this.handleSelection}
                  elementHeight={this.props.elementHeight || 32}
                  nb2show={this.props.maxMenuHeight || 4}
                  hintTextAutocomplete={this.props.hintTextAutocomplete || 'search'}
                  selectionsRenderer={handleCustomDisplaySelections}
                  style={this.props.style || { width: 'auto', textAlign: 'left' }}
                  checkPosition={this.props.checkPosition || 'left'}
                  popoverWidth={popoverWidth}
               >
                  {dataDisplay}
               </SuperSelectField>
            </div>
         </MuiThemeProvider>
      );
   }
}

module.exports.Superselectfield = Superselectfield;
